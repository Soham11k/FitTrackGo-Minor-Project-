"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, Play, Pause, SkipForward, Check, Flame, Timer, Trophy, ArrowRight, ScanLine } from "lucide-react"
import type { ExerciseItem, ExerciseStep } from "@/lib/data"
import { addWorkout } from "@/lib/store-supabase"
import { RingGauge } from "@/components/ring-gauge"
import { WorkoutStepCamera } from "@/components/workout-step-camera"
import { MotionCelebrate } from "@/components/motion-celebrate"
import { DURATION, EASE, SPRING } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { CueFocusProvider } from "@/components/coach/cue-focus-context"
import { getAICoachIdForStep } from "@/lib/exercise-ai-map"
import {
  saveWorkoutSessionSnapshot,
  clearWorkoutSessionSnapshot,
  readWorkoutSessionSnapshot,
} from "@/lib/workout-session-snapshot"
import { WORKOUTS } from "@/lib/workouts-theme"

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
  resume = false,
  onExit,
}: {
  exercise: ExerciseItem
  /** When true, restore mid-workout state from localStorage for this exercise if present. */
  resume?: boolean
  onExit: (completed: boolean) => void
}) {
  const steps: ExerciseStep[] = useMemo(
    () =>
      exercise.steps && exercise.steps.length > 0
        ? exercise.steps
        : [{ name: exercise.title, duration: exercise.duration, reps: "Single block" }],
    [exercise.steps, exercise.title, exercise.duration],
  )

  const snapOnLoad = useMemo(() => {
    if (!resume || typeof window === "undefined") return null
    const s = readWorkoutSessionSnapshot()
    if (!s || s.exerciseId !== exercise.id) return null
    return s
  }, [resume, exercise.id])

  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(() => snapOnLoad?.index ?? 0)
  const [phase, setPhase] = useState<Phase>(() =>
    snapOnLoad?.phase === "rest" ? "rest" : "active",
  )
  const firstStepSeconds = useMemo(
    () => parseDurationToSeconds(steps[snapOnLoad?.index ?? 0]?.duration),
    [steps, snapOnLoad?.index],
  )
  const [secondsLeft, setSecondsLeft] = useState(
    () =>
      snapOnLoad && (snapOnLoad.phase === "active" || snapOnLoad.phase === "rest")
        ? snapOnLoad.secondsLeft
        : firstStepSeconds,
  )
  const [totalSeconds, setTotalSeconds] = useState(
    () =>
      snapOnLoad && (snapOnLoad.phase === "active" || snapOnLoad.phase === "rest")
        ? snapOnLoad.totalSeconds
        : firstStepSeconds,
  )
  const [paused, setPaused] = useState(() => snapOnLoad?.paused ?? false)
  const [startedAt] = useState(() => Date.now())
  const [finalDurationSec, setFinalDurationSec] = useState<number | null>(null)
  const savedRef = useRef(false)
  const reduceMotion = useReducedMotion() ?? false

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  useEffect(() => {
    if (resume) return
    const snap = readWorkoutSessionSnapshot()
    if (snap?.exerciseId === exercise.id) clearWorkoutSessionSnapshot()
  }, [resume, exercise.id])

  useEffect(() => {
    if (phase === "done") return
    saveWorkoutSessionSnapshot({
      exerciseId: exercise.id,
      exercise,
      index,
      phase: phase === "rest" ? "rest" : "active",
      secondsLeft,
      totalSeconds,
      paused,
    })
  }, [phase, index, secondsLeft, totalSeconds, paused, exercise])

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

  const currentStep = steps[index] ?? steps[0]
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
    clearWorkoutSessionSnapshot()
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
  const timerProgressRemaining = totalSeconds > 0 ? secondsLeft / totalSeconds : 0

  const overlay = (
    <div
      data-testid="screen-workout-player"
      className={cn(
        "fixed inset-0 z-50 grid h-[100dvh]",
        phase === "done"
          ? "grid-rows-[auto_minmax(0,1fr)]"
          : "grid-rows-[auto_auto_minmax(0,1fr)_auto]",
      )}
      style={{ backgroundColor: WORKOUTS.bg, color: WORKOUTS.white }}
    >
      <header
        className="flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-xl"
        style={{ borderBottom: `1px solid ${WORKOUTS.cardBorder}`, backgroundColor: WORKOUTS.black }}
      >
        <button
          type="button"
          onClick={() => onExit(false)}
          aria-label="Exit workout"
          className="flex h-9 w-9 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2"
          style={{
            border: `1px solid ${WORKOUTS.cardBorder}`,
            backgroundColor: WORKOUTS.card,
            color: WORKOUTS.white,
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: WORKOUTS.muted }}
          >
            {exercise.title}
          </p>
          <div
            className="mt-1 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: WORKOUTS.card }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%`, backgroundColor: WORKOUTS.accent }}
              role="progressbar"
              aria-label="Workout progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            />
          </div>
        </div>
        <span
          className="whitespace-nowrap text-xs font-bold tabular-nums"
          style={{ color: WORKOUTS.muted }}
        >
          {Math.min(index + 1, totalSteps)}/{totalSteps}
        </span>
      </header>

      {phase === "done" ? (
        <div className="flex min-h-0 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-4 text-center">
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
        </div>
      ) : (
        <>
          <div
            className="px-4 py-3 text-center"
            style={{ borderBottom: `1px solid ${WORKOUTS.cardBorder}`, backgroundColor: WORKOUTS.black }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: WORKOUTS.muted }}>
              {isRest ? "Rest" : `Step ${index + 1} of ${totalSteps}`}
            </p>
            <h2
              data-testid="workout-step-name"
              className="mt-2 text-xl font-black uppercase leading-tight sm:text-2xl"
              style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif", color: WORKOUTS.white }}
              aria-live="polite"
            >
              {isRest ? "Catch your breath" : currentStep.name}
            </h2>
            {!isRest ? (
              <p className="mt-2 line-clamp-2 text-sm leading-snug" style={{ color: WORKOUTS.muted }}>
                {currentStep.reps}
              </p>
            ) : (
              <p className="mt-2 text-sm" style={{ color: WORKOUTS.muted }}>
                Next interval starts automatically after rest.
              </p>
            )}
            {!isRest && steps[index + 1] ? (
              <p
                className="mt-3 rounded-full px-3 py-1 text-xs"
                style={{ color: WORKOUTS.muted, backgroundColor: WORKOUTS.card }}
              >
                Up next:{" "}
                <span className="font-semibold" style={{ color: WORKOUTS.white }}>
                  {steps[index + 1].name}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto overflow-x-hidden">
            {phase === "active" ? (
              <section className="shrink-0 space-y-2 px-4 pb-2 pt-2" aria-label="Live pose and camera">
                <div className="flex flex-col items-center gap-1">
                  <p
                    className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.22em]"
                    style={{ color: WORKOUTS.accent }}
                  >
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px]"
                      style={{ backgroundColor: WORKOUTS.accentDim, border: `1px solid ${WORKOUTS.accentBorder}` }}
                    >
                      ● Live
                    </span>
                    <ScanLine className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Camera feed
                  </p>
                  <p
                    className="max-w-[20rem] text-center text-[0.6875rem] leading-snug"
                    style={{ color: WORKOUTS.muted }}
                  >
                    Loading. Lighting helps detection.
                  </p>
                </div>
                <div
                  className="flex min-h-[12rem] justify-center overflow-hidden rounded-2xl border"
                  style={{ borderColor: WORKOUTS.cardBorder, backgroundColor: WORKOUTS.card }}
                >
                  <CueFocusProvider
                    key={getAICoachIdForStep(currentStep.name) ?? currentStep.name}
                    exerciseId={getAICoachIdForStep(currentStep.name) ?? "unknown"}
                    breakdown={[]}
                  >
                    <WorkoutStepCamera stepName={currentStep.name} isActive paused={paused} hideStepEyebrow />
                  </CueFocusProvider>
                </div>
              </section>
            ) : (
              <section className="shrink-0 px-4 pb-2 pt-3 text-center" aria-label="Rest period">
                <p className="text-xs" style={{ color: WORKOUTS.muted }}>
                  Camera pauses during rest — you&apos;ll see live tracking again on the next work step.
                </p>
              </section>
            )}

            <div className="flex shrink-0 flex-col items-center justify-center gap-3 px-6 py-4 pb-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: WORKOUTS.muted }}>
                Timer
              </p>
              <div role="timer" aria-live="polite" className="shrink-0">
                <RingGauge
                  value={timerProgressRemaining}
                  max={1}
                  size={168}
                  thickness={11}
                  progressClassName={isRest ? "stroke-[#5ac8fa]" : "stroke-[#34c759]"}
                  trackClassName={isRest ? "stroke-[#5ac8fa]/10" : "stroke-[#34c759]/10"}
                >
                  <motion.span
                    key={secondsLeft}
                    className="text-4xl font-black tabular-nums sm:text-5xl"
                    style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif", color: WORKOUTS.white }}
                    initial={reduceMotion ? false : { scale: 0.96, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: DURATION.fast, ease: EASE.out }}
                  >
                    {formatSeconds(secondsLeft)}
                  </motion.span>
                </RingGauge>
              </div>
            </div>
          </div>

          <footer
            className="px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
            style={{ borderTop: `1px solid ${WORKOUTS.cardBorder}`, backgroundColor: WORKOUTS.black }}
          >
            <div className="mx-auto grid w-full max-w-md grid-cols-[3rem_1fr_3rem] items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Resume" : "Pause"}
                className="flex h-12 w-full items-center justify-center rounded-xl transition-transform active:scale-95"
                style={{
                  border: `1px solid ${WORKOUTS.cardBorder}`,
                  backgroundColor: WORKOUTS.card,
                  color: WORKOUTS.white,
                }}
              >
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={skip}
                aria-label={isRest ? "Skip rest" : "Finish this step"}
                className="flex h-[3.125rem] min-w-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black uppercase tracking-[0.08em] transition-[transform,filter] hover:brightness-[1.06] active:scale-[0.98] max-sm:gap-1 max-sm:px-3 max-sm:text-[0.7rem]"
                style={{
                  backgroundColor: isRest ? "#5ac8fa" : WORKOUTS.accent,
                  color: WORKOUTS.white,
                }}
              >
                {isRest ? <SkipForward className="h-5 w-5 shrink-0" /> : <ArrowRight className="h-5 w-5 shrink-0" />}
                <span className="truncate leading-tight max-sm:leading-tight">
                  {isRest ? "Skip rest" : "Finish step"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFinalDurationSec(Math.round((Date.now() - startedAt) / 1000))
                  setPhase("done")
                }}
                aria-label="End workout"
                className="flex h-12 w-full items-center justify-center rounded-xl transition-transform active:scale-95"
                style={{
                  border: `1px solid ${WORKOUTS.cardBorder}`,
                  backgroundColor: WORKOUTS.card,
                  color: WORKOUTS.white,
                }}
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  )

  if (!mounted || typeof document === "undefined") return null

  return createPortal(overlay, document.body)
}
