"use client"

import { useRef, useState, useEffect, useCallback, useLayoutEffect } from "react"
import { Camera, ScanLine, Loader2 } from "lucide-react"
import {
  initPoseDetection,
  detectPose,
  drawSkeleton,
  getBodyScanDetail,
  assessEnvironment,
  type EnvironmentAssessment,
  type LandmarkPoint,
} from "@/lib/pose-detection"
import type { ExerciseId } from "@/lib/form-analysis"

type PreviewMode = "off" | "loading" | "on" | "error"

const NEUTRAL_FORM_SCORE = 85

export function ExerciseBodyPreview(props: { exerciseId?: ExerciseId | null }) {
  const { exerciseId = null } = props
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const runningRef = useRef(false)
  const lastTimeRef = useRef(0)
  /** Latest coach exercise for assessEnvironment — ref avoids re-subscribing RAF when id changes while mode is "off" or while streaming. */
  const exerciseIdRef = useRef<ExerciseId | null>(exerciseId)

  const [mode, setMode] = useState<PreviewMode>("off")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [bodySummary, setBodySummary] = useState<string | null>(null)
  const [envAssessment, setEnvAssessment] = useState<EnvironmentAssessment | null>(null)
  const loadingSessionRef = useRef(0)

  const stopCamera = useCallback(() => {
    runningRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    lastTimeRef.current = 0
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    const v = videoRef.current
    if (v) v.srcObject = null
    setMode("off")
    setErrorMessage(null)
    setBodySummary(null)
    setEnvAssessment(null)
  }, [])

  useEffect(() => {
    exerciseIdRef.current = exerciseId
  }, [exerciseId])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      // eslint-disable-next-line react-hooks/exhaustive-deps -- teardown: clear src on the mounted video node
      const v = videoRef.current
      if (v) v.srcObject = null
    }
  }, [])

  const startCamera = useCallback(() => {
    setErrorMessage(null)
    setMode("loading")
  }, [])

  /** During `loading`, video + canvas must exist in DOM so refs attach. Finish init after commit. */
  useLayoutEffect(() => {
    if (mode !== "loading") return
    const session = ++loadingSessionRef.current
    let cancelled = false

    const waitForVideoCanvas = async (): Promise<boolean> => {
      for (let i = 0; i < 24; i++) {
        if (videoRef.current && canvasRef.current) return true
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
      }
      return !!(videoRef.current && canvasRef.current)
    }

    void (async () => {
      const ok = await initPoseDetection()
      if (cancelled || session !== loadingSessionRef.current) return
      if (!ok) {
        setMode("error")
        setErrorMessage("Could not load body detection. Check your connection and try again.")
        return
      }
      const refsReady = await waitForVideoCanvas()
      if (cancelled || session !== loadingSessionRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!refsReady || !video || !canvas) {
        setMode("error")
        setErrorMessage("Preview not ready. Try again.")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 24 },
          },
        })
        if (cancelled || session !== loadingSessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        await video.play()
        if (cancelled || session !== loadingSessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          video.srcObject = null
          return
        }
        setMode("on")
      } catch {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (video) video.srcObject = null
        if (cancelled || session !== loadingSessionRef.current) return
        setMode("error")
        setErrorMessage("Camera unavailable or permission denied. Use HTTPS or localhost, then allow the camera.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (mode !== "on") return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    runningRef.current = true
    lastTimeRef.current = 0

    const run = (timestamp: number) => {
      if (!runningRef.current) return
      rafRef.current = requestAnimationFrame(run)

      const delta = timestamp - lastTimeRef.current
      const isVideoReady =
        video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0
      const minDelta = isVideoReady ? 1000 / 30 : 1000 / 60
      if (delta < minDelta) return
      lastTimeRef.current = timestamp

      let cw = canvas.width || 640
      let ch = canvas.height || 480

      if (!isVideoReady) {
        const container = canvas.parentElement
        if (container) {
          const w = container.clientWidth || 640
          const h = container.clientHeight || 360
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
          }
          cw = canvas.width
          ch = canvas.height
        }
        ctx.clearRect(0, 0, cw, ch)
        return
      }

      const videoDisplayWidth = Math.max(1, video.clientWidth || video.videoWidth || 640)
      const videoDisplayHeight = Math.max(1, video.clientHeight || video.videoHeight || 480)
      if (canvas.width !== videoDisplayWidth || canvas.height !== videoDisplayHeight) {
        canvas.width = videoDisplayWidth
        canvas.height = videoDisplayHeight
      }
      cw = canvas.width
      ch = canvas.height

      const result = detectPose(video, timestamp)
      ctx.clearRect(0, 0, cw, ch)

      if (result?.landmarks?.length) {
        const lm = result.landmarks as LandmarkPoint[]
        const scan = getBodyScanDetail(lm)
        if (scan) {
          const line = `${scan.coveragePercent}% keypoints · ${scan.summary}`
          setBodySummary((prev) => (prev === line ? prev : line))
        }
        const env = assessEnvironment(lm, timestamp, exerciseIdRef.current ?? undefined)
        setEnvAssessment((prev) =>
          prev &&
          prev.fps === env.fps &&
          Math.round(prev.quality * 100) === Math.round(env.quality * 100) &&
          prev.suggestion === env.suggestion &&
          prev.fpsLow === env.fpsLow &&
          prev.angleRecommended === env.angleRecommended &&
          prev.cameraAngle === env.cameraAngle
            ? prev
            : env
        )

        drawSkeleton(ctx, lm, cw, ch, true, {
          left: result.leftHandLandmarks,
          right: result.rightHandLandmarks,
        }, NEUTRAL_FORM_SCORE)
      } else {
        setBodySummary((prev) => (prev === null ? prev : null))
        const env = assessEnvironment([], timestamp, exerciseIdRef.current ?? undefined)
        setEnvAssessment((prev) =>
          prev &&
          prev.fps === env.fps &&
          Math.round(prev.quality * 100) === Math.round(env.quality * 100) &&
          prev.suggestion === env.suggestion &&
          prev.angleRecommended === env.angleRecommended &&
          prev.cameraAngle === env.cameraAngle
            ? prev
            : env
        )
      }
    }

    rafRef.current = requestAnimationFrame(run)
    return () => {
      runningRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mode])

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden" aria-labelledby="exercise-body-check-heading">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <ScanLine className="h-4 w-4 text-metric-coach shrink-0" aria-hidden />
        <h2 id="exercise-body-check-heading" className="text-sm font-semibold text-foreground">
          Body check
        </h2>
      </div>
      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Preview your position with live body tracking. For rep counts and form scoring, use Open AI Coach below.
      </p>

      {mode === "off" || mode === "error" ? (
        <div className="px-4 pb-4 space-y-3">
          {mode === "error" && errorMessage && (
            <p className="text-xs text-destructive">{errorMessage}</p>
          )}
          <button
            type="button"
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-metric-coach/35 bg-metric-coach/10 py-3 text-sm font-semibold text-metric-coach hover:bg-metric-coach/15"
          >
            <Camera className="h-4 w-4 shrink-0" />
            Enable camera
          </button>
        </div>
      ) : null}

      {mode === "loading" || mode === "on" ? (
        <div className="px-4 pb-4 space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-secondary">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scaleX(-1)", zIndex: 10 }}
              aria-label="Body skeleton overlay"
            />
            {mode === "loading" ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/75 backdrop-blur-[2px]"
                aria-busy="true"
                aria-label="Starting camera"
              >
                <Loader2 className="h-8 w-8 animate-spin shrink-0 text-metric-coach" aria-hidden />
                <span className="text-sm font-medium text-foreground">Starting camera…</span>
              </div>
            ) : null}
          </div>
          {mode === "on" ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-typo-caption text-muted-foreground">
                {bodySummary && <span className="text-emerald-600 dark:text-emerald-400/90">{bodySummary}</span>}
                {envAssessment && (
                  <>
                    <span className={envAssessment.fpsLow ? "text-red-500/90" : "text-muted-foreground"}>
                      {envAssessment.fps} fps
                    </span>
                    <span
                      className={
                        envAssessment.quality > 0.6
                          ? "text-emerald-600/80 dark:text-emerald-400/70"
                          : envAssessment.quality > 0.3
                            ? "text-amber-600/80 dark:text-amber-400/70"
                            : "text-red-500/80"
                      }
                    >
                      Quality {Math.round(envAssessment.quality * 100)}%
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={stopCamera}
                className="w-full rounded-xl bg-secondary py-2.5 text-sm font-medium text-foreground border border-border hover:bg-secondary/80"
              >
                Stop camera
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
