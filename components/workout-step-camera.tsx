"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { Camera, Pause } from "lucide-react"
import {
  initPoseDetection,
  detectPose,
  drawSkeleton,
  getDetectionQuality,
  type LandmarkPoint,
} from "@/lib/pose-detection"
import { analyzeForm, type ExerciseId, type Landmark } from "@/lib/form-analysis"
import { COACH_FRAME_INTERVAL_MS } from "@/lib/pose-config"
import { getAICoachIdForStep } from "@/lib/exercise-ai-map"
import { isSecureContext } from "@/lib/secure-context"
import { drawCueFocusOverlay } from "@/lib/coach-vision/canvas-highlight"
import type { HighlightSpec } from "@/lib/coach-vision/cue-resolver"
import { useCueFocusOptional } from "@/components/coach/cue-focus-context"

type Props = {
  /** Current workout step title (maps to coach exercise when possible). */
  stepName: string
  /** False during rest or when workout is done / not showing this block. */
  isActive: boolean
  paused: boolean
  /**
   * In embedded flows the parent already shows the step title — omit the duplicated
   * "Live · Step name" eyebrow so layout stays compact.
   */
  hideStepEyebrow?: boolean
  /**
   * Optional override for cue overlay when parent wants to provide a spec
   * directly. When omitted, the component reads from CueFocusProvider.
   */
  focusedHighlight?: HighlightSpec | null
}

type PreviewBlock = null | "insecure" | "permission" | "unsupported" | "attach_timeout"

/**
 * Live front-camera + pose skeleton during an active workout step.
 * Pose init happens in parallel with opening the camera so the preview is never
 * blocked on MediaPipe WASM / model CDN latency (which showed as a black box).
 */
export function WorkoutStepCamera({
  stepName,
  isActive,
  paused,
  hideStepEyebrow = false,
  focusedHighlight = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const sessionRef = useRef(0)
  const pausedRef = useRef(paused)
  const exerciseIdRef = useRef<ExerciseId | null>(null)
  const poseOkRef = useRef(false)
  const videoFirstFrameSyncedRef = useRef(false)

  /** When camera preview cannot run, explain instead of an empty black box */
  const [previewBlock, setPreviewBlock] = useState<PreviewBlock>(null)
  /** Camera stream is attaching (brief); avoids black void while getUserMedia runs */
  const [cameraStarting, setCameraStarting] = useState(false)
  /** True when camera works but MediaPipe skeleton isn't ready yet or failed */
  const [mirrorOnlyHint, setMirrorOnlyHint] = useState(false)
  /** Poster / warm state: stream is live but decoded frames not visible yet */
  const [previewStreamLive, setPreviewStreamLive] = useState(false)
  /** First decoded video frame visible (avoids black void after play()) */
  const [videoFrameReady, setVideoFrameReady] = useState(false)
  /** User tapped “Retry camera” to re-run getUserMedia after permission / glitch */
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0)

  const reducedMotion = useReducedMotion() ?? false
  const cueCtx = useCueFocusOptional()
  const cueHighlightRef = useRef<HighlightSpec | null>(null)
  useEffect(() => {
    cueHighlightRef.current = focusedHighlight ?? cueCtx?.highlight ?? null
  }, [focusedHighlight, cueCtx?.highlight])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    exerciseIdRef.current = getAICoachIdForStep(stepName)
  }, [stepName])

  useEffect(() => {
    if (!isActive) {
      setPreviewBlock(null)
      setMirrorOnlyHint(false)
      setVideoFrameReady(false)
      setPreviewStreamLive(false)
      setCameraStarting(false)
      poseOkRef.current = false
      runningRef.current = false
      videoFirstFrameSyncedRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      const v = videoRef.current
      if (v) v.srcObject = null
      return
    }

    const session = ++sessionRef.current
    let cancelled = false
    poseOkRef.current = false
    videoFirstFrameSyncedRef.current = false

    setPreviewBlock(null)
    setMirrorOnlyHint(false)
    setVideoFrameReady(false)
    setPreviewStreamLive(false)
    setCameraStarting(true)

    const waitForRefs = async (): Promise<boolean> => {
      const deadline =
        typeof performance !== "undefined" ? performance.now() + 9000 : 0
      for (;;) {
        if (cancelled || session !== sessionRef.current) return false
        if (videoRef.current && canvasRef.current) return true
        if (typeof performance !== "undefined" && performance.now() > deadline) return false
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
      }
    }

    void (async () => {
      if (!isSecureContext()) {
        if (!cancelled && session === sessionRef.current) {
          setPreviewBlock("insecure")
          setCameraStarting(false)
        }
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled && session === sessionRef.current) {
          setPreviewBlock("unsupported")
          setCameraStarting(false)
        }
        return
      }

      // Run MediaPipe in parallel — do not gate the camera preview on WASM download.
      void initPoseDetection()
        .then((ok) => {
          if (cancelled || session !== sessionRef.current) return
          poseOkRef.current = Boolean(ok)
          setMirrorOnlyHint(streamRef.current != null && !ok)
        })
        .catch(() => {
          if (cancelled || session !== sessionRef.current) return
          poseOkRef.current = false
          setMirrorOnlyHint(streamRef.current != null)
        })

      const refsOk = await waitForRefs()
      if (cancelled || session !== sessionRef.current) {
        return
      }
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!refsOk || !video || !canvas) {
        if (!cancelled && session === sessionRef.current) {
          setPreviewBlock("attach_timeout")
          setCameraStarting(false)
        }
        return
      }

      const clearStartingIfCurrent = () => {
        if (!cancelled && session === sessionRef.current) setCameraStarting(false)
      }

      try {
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30, min: 15 },
            },
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        }
        if (cancelled || session !== sessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          clearStartingIfCurrent()
          setPreviewStreamLive(false)
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        if (!cancelled && session === sessionRef.current) setPreviewStreamLive(true)
        const markFrameReady = () => {
          if (cancelled || session !== sessionRef.current) return
          if (video.readyState >= 2 && video.videoWidth > 0) setVideoFrameReady(true)
        }
        video.addEventListener("loadeddata", markFrameReady, { once: true })
        video.addEventListener("playing", markFrameReady, { once: true })

        await video.play().catch(() => {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          video.srcObject = null
          if (!cancelled && session === sessionRef.current) setPreviewStreamLive(false)
          throw new Error("play_failed")
        })

        if (cancelled || session !== sessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          video.srcObject = null
          clearStartingIfCurrent()
          setPreviewStreamLive(false)
          return
        }

        setCameraStarting(false)
        const ctx = canvas.getContext("2d", { alpha: true })
        if (!ctx) {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          video.srcObject = null
          clearStartingIfCurrent()
          setPreviewStreamLive(false)
          if (!cancelled && session === sessionRef.current) setPreviewBlock("unsupported")
          return
        }

        runningRef.current = true
        let lastTime = 0

        const run = (timestamp: number) => {
          if (!runningRef.current || session !== sessionRef.current) return
          rafRef.current = requestAnimationFrame(run)

          if (pausedRef.current) {
            lastTime = 0
            return
          }

          const delta = timestamp - lastTime
          const isVideoReady =
            video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
          if (isVideoReady && !videoFirstFrameSyncedRef.current) {
            videoFirstFrameSyncedRef.current = true
            setVideoFrameReady(true)
          }
          const minDelta = isVideoReady ? COACH_FRAME_INTERVAL_MS : 1000 / 30
          if (delta < minDelta) return
          lastTime = timestamp

          if (!isVideoReady) return

          const cw = Math.max(1, video.clientWidth || video.videoWidth || 640)
          const ch = Math.max(1, video.clientHeight || video.videoHeight || 480)
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw
            canvas.height = ch
          }

          if (!poseOkRef.current) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            return
          }

          const result = detectPose(video, timestamp, { skipHands: true })
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (result?.landmarks?.length) {
            const lm = result.landmarks as LandmarkPoint[]
            const exId = exerciseIdRef.current
            let formScore = 85
            let goodForm = true
            if (exId) {
              const worldLm = (result.worldLandmarks ?? undefined) as Landmark[] | undefined
              const res = analyzeForm(lm as Landmark[], exId, {
                world: worldLm && worldLm.length >= 33 ? worldLm : undefined,
                trackingQuality: getDetectionQuality(),
              })
              formScore = res.score
              goodForm = res.isGoodForm
            }
            const focused = cueHighlightRef.current
            const faultSegmentPairs = focused?.kind === "improve" ? focused.segmentPairs : []
            drawSkeleton(
              ctx,
              lm,
              canvas.width,
              canvas.height,
              goodForm,
              {
                left: result.leftHandLandmarks,
                right: result.rightHandLandmarks,
              },
              formScore,
              faultSegmentPairs,
            )
            if (focused) {
              drawCueFocusOverlay(
                ctx,
                lm as unknown as Landmark[],
                focused,
                canvas.width,
                canvas.height,
                reducedMotion,
              )
            }
          }
        }

        rafRef.current = requestAnimationFrame(run)
      } catch {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        if (!cancelled && session === sessionRef.current) {
          setPreviewBlock("permission")
          setMirrorOnlyHint(false)
          setPreviewStreamLive(false)
          setCameraStarting(false)
        }
      }
    })()

    return () => {
      cancelled = true
      runningRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      // eslint-disable-next-line react-hooks/exhaustive-deps -- teardown: detach stream from active video element
      const videoEl = videoRef.current
      if (videoEl) videoEl.srcObject = null
    }
  }, [isActive, cameraRetryNonce])

  if (!isActive) return null

  const showFrameWait =
    !previewBlock && !cameraStarting && previewStreamLive && !videoFrameReady

  return (
    <div className="mx-auto w-full max-w-md shrink-0">
      {!hideStepEyebrow ? (
        <div className="mb-1.5 flex items-center justify-center gap-1.5 text-typo-eyebrow font-semibold uppercase tracking-wider text-muted-foreground">
          <Camera className="h-3 w-3 text-metric-coach" aria-hidden />
          <span>Live · {stepName}</span>
        </div>
      ) : (
        <div className="sr-only">
          Live camera preview for {stepName}
        </div>
      )}
      <div className="relative aspect-video min-h-[11rem] w-full max-h-[min(42vh,340px)] overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-muted/90 via-card to-muted shadow-[0_12px_40px_-24px_oklch(0_0_0/0.5),inset_0_1px_0_0_oklch(1_0_0/0.06)] ring-1 ring-inset ring-white/[0.04] dark:from-[oklch(0.14_0_0)] dark:via-[oklch(0.09_0_0)] dark:to-[oklch(0.07_0_0)] dark:border-white/10">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full min-h-[11rem] w-full bg-black object-cover"
          playsInline
          muted
          style={{ transform: "scaleX(-1)", zIndex: 0 }}
        />
        <canvas
          ref={canvasRef}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${previewBlock || !videoFrameReady ? "hidden" : ""}`}
          style={{ transform: "scaleX(-1)", zIndex: 10 }}
          aria-label="Body tracking overlay"
        />
        {cameraStarting && !previewBlock ? (
          <div className="absolute inset-0 z-[8] flex items-center justify-center bg-primary/[0.08] backdrop-blur-[1px]">
            <p className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-typo-micro font-semibold uppercase tracking-wider text-white/92 shadow-sm">
              Starting camera…
            </p>
          </div>
        ) : null}
        {showFrameWait ? (
          <div
            className="pointer-events-none absolute bottom-3 left-1/2 z-[9] flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/35 bg-black/45 px-3 py-1.5 shadow-lg backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_70%,transparent)]" />
            <span className="text-typo-micro font-semibold uppercase tracking-[0.16em] text-white/85">
              Decoding preview…
            </span>
          </div>
        ) : null}
        {previewBlock ? (
          <div className="absolute inset-0 z-[15] flex flex-col items-center justify-center gap-2 bg-secondary/92 p-6 text-center">
            <Camera className="h-10 w-10 text-muted-foreground opacity-70" aria-hidden />
            <p className="text-sm font-semibold text-foreground">
              {previewBlock === "insecure"
                ? "Camera needs HTTPS or localhost"
                : previewBlock === "unsupported"
                  ? "Camera not supported in this browser"
                  : previewBlock === "attach_timeout"
                    ? "Preview didn’t attach in time"
                    : "Camera permission denied"}
            </p>
            <p className="max-w-[18rem] text-typo-caption text-muted-foreground">
              {previewBlock === "insecure"
                ? "Open http://localhost:3000 or run npm run dev:https — the workout preview needs a secure origin for getUserMedia."
                : previewBlock === "unsupported"
                  ? "Continue the workout — timer and Finish step still work without the live view."
                  : previewBlock === "attach_timeout"
                    ? "Try leaving the workout and reopening it. Finish step below still advances the workout."
                    : "Allow camera for this site in browser settings, then retry. Timer and Finish step still work."}
            </p>
            {previewBlock === "permission" || previewBlock === "attach_timeout" || previewBlock === "insecure" ? (
              <button
                type="button"
                className="mt-1 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
                onClick={() => setCameraRetryNonce((n) => n + 1)}
              >
                Retry camera
              </button>
            ) : null}
          </div>
        ) : null}
        {!previewBlock && mirrorOnlyHint ? (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[12] rounded-lg bg-black/55 px-2 py-1.5 text-center text-[0.65rem] font-medium leading-snug text-white/90 ring-1 ring-white/15">
            Body model still loading — allow scripts and network for WASM. Mirror works; skeleton appears when ready.
          </div>
        ) : null}
        {paused ? (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/55 backdrop-blur-[2px]"
            aria-hidden
          >
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg">
              <Pause className="h-4 w-4 text-metric-coach" aria-hidden />
              Paused
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
