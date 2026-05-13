"use client"

import { useEffect, useRef } from "react"
import { Camera, Pause } from "lucide-react"
import {
  initPoseDetection,
  detectPose,
  drawSkeleton,
  getDetectionQuality,
  type LandmarkPoint,
} from "@/lib/pose-detection"
import { analyzeForm, type ExerciseId, type Landmark } from "@/lib/form-analysis"
import { getAICoachIdForStep } from "@/lib/exercise-ai-map"

type Props = {
  /** Current workout step title (maps to coach exercise when possible). */
  stepName: string
  /** False during rest or when workout is done / not showing this block. */
  isActive: boolean
  paused: boolean
}

/**
 * Live front-camera + pose skeleton during an active workout step.
 * Stops when rest phase or parent hides; restarts stream on the next active step.
 */
export function WorkoutStepCamera({ stepName, isActive, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const sessionRef = useRef(0)
  const pausedRef = useRef(paused)
  const exerciseIdRef = useRef<ExerciseId | null>(null)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    exerciseIdRef.current = getAICoachIdForStep(stepName)
  }, [stepName])

  useEffect(() => {
    if (!isActive) {
      runningRef.current = false
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

    const waitForRefs = async (): Promise<boolean> => {
      for (let i = 0; i < 24; i++) {
        if (videoRef.current && canvasRef.current) return true
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
      }
      return !!(videoRef.current && canvasRef.current)
    }

    void (async () => {
      const ok = await initPoseDetection()
      if (cancelled || session !== sessionRef.current) return
      if (!ok) return

      const refsOk = await waitForRefs()
      if (cancelled || session !== sessionRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!refsOk || !video || !canvas) return

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 },
          },
        })
        if (cancelled || session !== sessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        await video.play()
        if (cancelled || session !== sessionRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          video.srcObject = null
          return
        }

        const ctx = canvas.getContext("2d")
        if (!ctx) return

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
          const minDelta = isVideoReady ? 1000 / 24 : 1000 / 30
          if (delta < minDelta) return
          lastTime = timestamp

          if (!isVideoReady) return

          const cw = Math.max(1, video.clientWidth || video.videoWidth || 640)
          const ch = Math.max(1, video.clientHeight || video.videoHeight || 480)
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw
            canvas.height = ch
          }

          const result = detectPose(video, timestamp)
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
            )
          }
        }

        rafRef.current = requestAnimationFrame(run)
      } catch {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
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
  }, [isActive])

  if (!isActive) return null

  return (
    <div className="w-full max-w-md mx-auto shrink-0">
      <div className="mb-1.5 flex items-center justify-center gap-1.5 text-typo-eyebrow font-semibold uppercase tracking-wider text-muted-foreground">
        <Camera className="h-3 w-3 text-metric-coach" aria-hidden />
        <span>Live · {stepName}</span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-secondary shadow-sm">
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
          aria-label="Pose overlay"
        />
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
