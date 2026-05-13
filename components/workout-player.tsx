"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, Play, Pause, SkipForward, Check, Flame, Timer, Trophy } from "lucide-react"
import type { ExerciseItem, ExerciseStep } from "@/lib/data"
import { addWorkout } from "@/lib/store-supabase"
import { RingGauge } from "@/components/ring-gauge"
import { WorkoutStepCamera } from "@/components/workout-step-camera"
import { MotionCelebrate } from "@/components/motion-celebrate"
import { DURATION, EASE, SPRING } from "@/lib/motion"
import { toast } from "sonner"

/** Parse a "45 sec" / "3 min" / "1:30" string into seconds. Defaults to 45s. */
function parseDurationToSeconds(value: string | undefined): number {
  if (!value) return 45
  const trimmed = value.trim().toLowerCase()
  const mmss = /^(\d+):(\d{1,2})$/.exec(trimmed)
  if (mmss) {
    return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10)
  }
  const m = /(\d+(?:\.\d+)?)\s*(sec|second|seconds|s|min|minute|minutes|m)\b/.exec(trimmed)
  if (!m) return 45
  const n = parseFloat(m[1])
  const unit = m[2]
  if (unit.startsWith("m")) return Math.max(1, Math.round(n * 60))
  return Math.max(1, Math.round(n))
}

function formatSeconds(total: number): string {
  const t = Math.max(0, Math.floor(total))
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

const REST_SECONDS = 15
/** How long to hold the celebration card before navigating back. */
const DONE_HOLD_MS = 1600
const DONE_HOLD_MS_REDUCED = 500

type Phase = "active" | "rest" | "done"

export function WorkoutPlayer({
  exercise,
  onExit,
}: {
  exercise: ExerciseItem
  onExit: (completed: boolean) => void
}) {
  const steps: ExerciseStep[] = useMemo(
    () =>
      exercise.steps && exercise.steps.length > 0
        ? exercise.steps
        : [{ name: exercise.title, duration: exercise.duration, reps: "Single block" }],
    [exercise.steps, exercise.title, exercise.duration]
  )

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>("active")
  const initialSeconds = useMemo(() => parseDurationToSeconds(steps[0]?.duration), [steps])
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds)
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds)
  const [paused, setPaused] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [finalDurationSec, setFinalDurationSec] = useState<number | null>(null)
  const savedRef = useRef(false)
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    if (phase !== "done") return
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(15)
      }
    } catch {
      /* ignore */
    }
  }, [phase])

  const currentStep = steps[index]
  const totalSteps = steps.length
  const progress = ((index + (phase === "rest" ? 0.5 : 0)) / totalSteps) * 100

  useEffect(() => {
    if (phase === "done" || paused) return
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          advance()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paused, index])

  function advance() {
    if (phase === "active") {
      if (index + 1 >= totalSteps) {
        setFinalDurationSec(Math.round((Date.now() - startedAt) / 1000))
        setPhase("done")
        return
      }
      setPhase("rest")
      setSecondsLeft(REST_SECONDS)
      setTotalSeconds(REST_SECONDS)
      return
    }
    if (phase === "rest") {
      const next = index + 1
      const nextSec = parseDurationToSeconds(steps[next]?.duration)
      setIndex(next)
      setPhase("active")
      setSecondsLeft(nextSec)
      setTotalSeconds(nextSec)
    }
  }

  function skip() {
    if (phase === "done") return
    advance()
  }

  async function finish() {
    if (savedRef.current) {
      onExit(true)
      return
    }
    savedRef.current = true
    const durationSeconds =
      finalDurationSec ?? Math.round((Date.now() - startedAt) / 1000)
    try {
      await addWorkout({
        title: exercise.title,
        category: exercise.category,
        duration: Math.max(durationSeconds, exercise.durationMin * 60),
        calories: exercise.calories,
        exerciseCount: totalSteps,
      })
      toast.success(`"${exercise.title}" completed!`)
      onExit(true)
    } catch (err) {
      console.error(err)
      toast.error("Workout finished, but we couldn't save it. Check your connection.")
      onExit(false)
    }
  }

  useEffect(() => {
    if (phase !== "done") return
    const hold = reduceMotion ? DONE_HOLD_MS_REDUCED : DONE_HOLD_MS
    const id = setTimeout(() => {
      void finish()
    }, hold)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduceMotion])

  const isRest = phase === "rest"
  // Remaining time as a fraction from 1 → 0 (full ring at start, empty at end).
  const timerProgressRemaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 0

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => onExit(false)}
          aria-label="Exit workout"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {exercise.title}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
              role="progressbar"
              aria-label="Workout progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            />
          </div>
        </div>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground whitespace-nowrap">
          {Math.min(index + 1, totalSteps)}/{totalSteps}
        </span>
      </header>

      <main className="flex flex-1 min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-4 text-center">
        {phase === "done" ? (
          <MotionCelebrate
            className="flex w-full max-w-xs flex-col items-center gap-4 rounded-3xl border border-border/80 bg-card/80 p-6 shadow-[var(--shadow-card)] backdrop-blur-xl dark:border-white/10"
            role="status"
            aria-live="polite"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_15%,transparent)]"
              initial={reduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={reduceMotion ? { duration: DURATION.fast } : { ...SPRING.celebrate, delay: 0.08 }}
            >
              <Trophy className="h-8 w-8" strokeWidth={2.5} />
            </motion.div>
            <div className="space-y-1">
              <p className="text-typo-eyebrow font-bold uppercase tracking-[0.25em] text-primary">Complete</p>
              <h2
                className="text-2xl font-bold text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Nice work!
              </h2>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-metric-move/10 py-3">
                <Timer className="h-4 w-4 text-metric-move" />
                <span
                  className="text-2xl font-bold tabular-nums leading-none text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {Math.max(1, Math.round((finalDurationSec ?? 0) / 60))}
                </span>
                <span className="text-typo-micro font-bold uppercase tracking-[0.18em] text-muted-foreground">min</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-metric-hr/10 py-3">
                <Flame className="h-4 w-4 text-metric-hr" />
                <span
                  className="text-2xl font-bold tabular-nums leading-none text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {exercise.calories}
                </span>
                <span className="text-typo-micro font-bold uppercase tracking-[0.18em] text-muted-foreground">kcal</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Saving to your history…</p>
          </MotionCelebrate>
        ) : (
          <>
            {phase === "active" && (
              <WorkoutStepCamera
                stepName={currentStep.name}
                isActive
                paused={paused}
              />
            )}
            <p className="text-typo-caption font-bold uppercase tracking-[0.25em] text-muted-foreground">
              {isRest ? "Rest" : `Step ${index + 1}`}
            </p>
            <h2
              className="text-3xl font-bold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
              aria-live="polite"
            >
              {isRest ? "Catch your breath" : currentStep.name}
            </h2>
            {!isRest && (
              <p className="text-sm text-muted-foreground">{currentStep.reps}</p>
            )}
            <div role="timer" aria-live="polite" className="shrink-0">
              <RingGauge
                value={timerProgressRemaining}
                max={1}
                size={196}
                thickness={12}
                progressClassName={
                  isRest ? "stroke-metric-spo2" : "stroke-metric-move"
                }
                trackClassName={
                  isRest ? "stroke-metric-spo2/10" : "stroke-metric-move/10"
                }
              >
                <motion.span
                  key={secondsLeft}
                  className="text-5xl font-bold tabular-nums text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                  initial={reduceMotion ? false : { scale: 0.96, opacity: 0.7 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: DURATION.fast, ease: EASE.out }}
                >
                  {formatSeconds(secondsLeft)}
                </motion.span>
              </RingGauge>
            </div>
            {!isRest && steps[index + 1] && (
              <p className="text-xs text-muted-foreground">Up next: {steps[index + 1].name}</p>
            )}
          </>
        )}
      </main>

      {phase !== "done" && (
        <footer className="sticky bottom-0 z-10 flex items-center justify-center gap-4 border-t border-border bg-background/90 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume" : "Pause"}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-transform active:scale-95"
          >
            {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip"
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold text-primary-foreground active:scale-[0.98] transition-colors ${
              isRest ? "bg-metric-spo2" : "bg-primary"
            }`}
          >
            <SkipForward className="h-5 w-5" />
            {isRest ? "Skip rest" : "Finish step"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFinalDurationSec(Math.round((Date.now() - startedAt) / 1000))
              setPhase("done")
            }}
            aria-label="End workout"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground transition-transform active:scale-95"
          >
            <Check className="h-5 w-5" />
          </button>
        </footer>
      )}
    </div>
  )
}
