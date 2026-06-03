"use client"

import { motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, CheckCircle2, RotateCcw, Trophy } from "lucide-react"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { COACH_FORM, CoachFormHeader } from "@/components/ai-coach/coach-form-ui"

export function CoachWorkoutComplete({
  streakDays,
  guest,
  exerciseName,
  reps,
  formPct,
  qualityPct,
  formScore,
  encouragement,
  zeroRepsWarning,
  askCoachSlot,
  extrasSlot,
  onTryAgain,
  onNewExercise,
}: {
  streakDays: number
  guest?: boolean
  exerciseName: string
  reps: number
  formPct: number
  qualityPct: number
  formScore: number
  encouragement: string
  zeroRepsWarning?: string | null
  askCoachSlot?: React.ReactNode
  extrasSlot?: React.ReactNode
  onTryAgain: () => void
  onNewExercise: () => void
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <div
      className="flex min-h-dvh flex-col pb-28"
      style={{ backgroundColor: COACH_FORM.black, fontFamily: COACH_FORM.bodyFont }}
    >
      <CoachFormHeader streakDays={streakDays} guest={guest} />

      <div className="px-4 pt-2">
        <motion.div
          className="rounded-2xl border px-4 py-6"
          style={{ backgroundColor: COACH_FORM.card, borderColor: COACH_FORM.cardBorder }}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: COACH_FORM.accentDim, boxShadow: `0 0 24px ${COACH_FORM.accent}33` }}
            >
              <Trophy className="h-7 w-7" style={{ color: COACH_FORM.accent }} aria-hidden />
            </div>
            <h1
              className="text-[1.65rem] font-normal uppercase leading-none tracking-[0.04em] text-white"
              style={{ fontFamily: COACH_FORM.displayFont }}
            >
              Workout complete
            </h1>
            <p className="mt-2 text-sm capitalize" style={{ color: COACH_FORM.muted }}>
              {exerciseName}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 border-t pt-5" style={{ borderColor: COACH_FORM.cardBorder }}>
            {[
              { label: "Reps", value: String(reps) },
              { label: "Form", value: `${formPct}%` },
              { label: "Quality", value: `${qualityPct}%` },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: COACH_FORM.muted, fontFamily: COACH_FORM.labelFont }}
                >
                  {stat.label}
                </p>
                <p
                  className="mt-1 text-xl font-normal tabular-nums text-white"
                  style={{ fontFamily: COACH_FORM.displayFont }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: COACH_FORM.muted, fontFamily: COACH_FORM.labelFont }}
            >
              Form score
            </p>
            <p
              className="mt-1 text-[3rem] font-normal uppercase leading-none tabular-nums text-white"
              style={{ fontFamily: COACH_FORM.displayFont }}
            >
              <AnimatedCounter value={formScore} duration={1} />%
            </p>
          </div>

          <div className="mt-4 flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: COACH_FORM.accent }} aria-hidden />
            <p className="text-[13px] leading-relaxed" style={{ color: COACH_FORM.muted }}>
              {encouragement}
            </p>
          </div>

          {zeroRepsWarning ? (
            <div
              className="mt-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5"
              style={{ borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.08)" }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <p className="text-[12px] leading-snug text-amber-100/90">{zeroRepsWarning}</p>
            </div>
          ) : null}
        </motion.div>

        {askCoachSlot ? <div className="mt-4">{askCoachSlot}</div> : null}
        {extrasSlot ? <div className="mt-4 space-y-4">{extrasSlot}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onTryAgain}
            className="flex items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-white"
            style={{ borderColor: COACH_FORM.cardBorder, backgroundColor: COACH_FORM.card, fontFamily: COACH_FORM.labelFont }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <button
            type="button"
            onClick={onNewExercise}
            className="flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-white"
            style={{ backgroundColor: COACH_FORM.accent, fontFamily: COACH_FORM.labelFont }}
          >
            New exercise
          </button>
        </div>
      </div>
    </div>
  )
}
