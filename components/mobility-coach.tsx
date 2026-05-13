"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, Timer, Sparkles } from "lucide-react"
import { initPoseDetection, detectPose, drawSkeleton, type LandmarkPoint } from "@/lib/pose-detection"
import { hasEnoughVisibilityForExercise, type ExerciseId } from "@/lib/form-analysis"
import { computeJointAngles } from "@/lib/coach-vision/hud-metrics"
import { MOBILITY_DRILLS, type MobilityDrillId, drillById } from "@/lib/mobility/drills"
import { anglesInBands, sampleAnglesFromHud, HoldScorer } from "@/lib/mobility/scorer"
import { addCoachSession, formatErr } from "@/lib/store-supabase"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { isNetworkError } from "@/lib/network-status"

type Phase = "pick" | "live" | "done"

export function MobilityCoach({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick")
  const [drillId, setDrillId] = useState<MobilityDrillId | null>(null)
  const [progress, setProgress] = useState(0)
  const [score, setScore] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const scorerRef = useRef<HoldScorer | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const finishingRef = useRef(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startLive = async (id: MobilityDrillId) => {
    const drill = drillById(id)
    if (!drill) return
    setDrillId(id)
    finishingRef.current = false
    scorerRef.current = new HoldScorer(drill.holdSec)
    lastTsRef.current = null
    setProgress(0)
    setScore(0)
    const ok = await initPoseDetection()
    if (!ok) {
      toast.error("Pose model failed to load")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => {})
      }
    } catch {
      toast.error("Camera required for mobility coach")
      return
    }
    setPhase("live")
  }

  useEffect(() => {
    if (phase !== "live" || !drillId) return
    const drill = drillById(drillId)
    if (!drill) return
    const exercise: ExerciseId = drill.poseExercise
    let running = true

    const loop = (ts: number) => {
      if (!running) return
      animRef.current = requestAnimationFrame(loop)
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      if (video.readyState < 2) return

      const cw = canvas.width || 640
      const ch = canvas.height || 480
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(video, 0, 0, cw, ch)

      const res = detectPose(video, ts)
      const lm = res?.landmarks as LandmarkPoint[] | undefined
      if (!lm?.length) return

      const bodyOk = hasEnoughVisibilityForExercise(lm, exercise)
      const angles = computeJointAngles(lm, exercise)
      const sample = sampleAnglesFromHud(angles)
      const inBand = bodyOk && anglesInBands(sample, drill.targetAngles)

      const last = lastTsRef.current
      lastTsRef.current = ts
      const dt = last != null ? Math.min(0.12, Math.max(0, (ts - last) / 1000)) : 0
      if (scorerRef.current && dt > 0) scorerRef.current.tick(inBand, dt)

      const p = scorerRef.current?.progress01() ?? 0
      const s = scorerRef.current?.scorePct() ?? 0
      setProgress(p)
      setScore(s)

      if (bodyOk) {
        drawSkeleton(ctx, lm as LandmarkPoint[], cw, ch, inBand, undefined, s, [])
      }

      if (p >= 1 && !finishingRef.current) {
        finishingRef.current = true
        running = false
        cancelAnimationFrame(animRef.current)
        void (async () => {
          try {
            const held = Math.round(scorerRef.current?.secondsHeld() ?? drill.holdSec)
            await addCoachSession({
              exercise: `Mobility · ${drill.name}`,
              reps: held,
              score: s,
              repScores: [],
              kind: "rom",
            })
            toast.success("Mobility set saved")
          } catch (e) {
            console.error(e)
            if (isNetworkError(e)) toast.info("Mobility session queued for sync")
            else toast.error(`Could not save: ${formatErr(e)}`)
          }
          stopCamera()
          setPhase("done")
        })()
      }
    }

    animRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [phase, drillId, stopCamera])

  if (phase === "pick") {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4 pb-28">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to strength coach
        </button>
        <header>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Mobility holds
          </h1>
          <p className="text-sm text-muted-foreground">ROM drills — timer only advances while joints stay in the green band.</p>
        </header>
        <div className="grid gap-3">
          {MOBILITY_DRILLS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => void startLive(d.id)}
              className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-secondary/40"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                {d.name}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
              <p className="mt-2 text-typo-micro font-bold uppercase tracking-wider text-primary">
                Target hold · {d.holdSec}s
              </p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (phase === "live" && drillId) {
    const drill = drillById(drillId)
    return (
      <div className="flex flex-col gap-3 px-4 pt-4 pb-28">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { stopCamera(); setPhase("pick") }} className="text-sm text-muted-foreground">
            Cancel
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4" />
            {drill?.name}
          </div>
          <span className="w-10" />
        </div>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-border bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover scale-x-[-1]" playsInline muted />
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full scale-x-[-1]" width={640} height={480} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex justify-between text-xs font-medium text-muted-foreground">
            <span>Hold quality</span>
            <span>{score}%</span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 pt-8 pb-28">
      <p className="text-center text-sm text-muted-foreground">Nice work — mobility minutes count on your dashboard this week.</p>
      <Button type="button" className="w-full max-w-sm" onClick={() => { setPhase("pick"); setDrillId(null) }}>
        Another drill
      </Button>
      <Button type="button" variant="outline" className="w-full max-w-sm" onClick={onBack}>
        Back
      </Button>
    </div>
  )
}
