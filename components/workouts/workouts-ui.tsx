"use client"

import { ChevronLeft, Play, Plus } from "lucide-react"
import { WORKOUTS, difficultyStyle } from "@/lib/workouts-theme"

export { WORKOUTS }

export function WorkoutsFilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition-colors"
      style={
        active
          ? { backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }
          : {
              backgroundColor: WORKOUTS.chipInactive,
              color: WORKOUTS.white,
              border: `1px solid ${WORKOUTS.cardBorder}`,
            }
      }
    >
      {label}
    </button>
  )
}

export function WorkoutsDifficultyBadge({ level }: { level: string }) {
  const style = difficultyStyle(level)
  return (
    <span
      className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em]"
      style={{
        color: style.color,
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
      }}
    >
      {level}
    </span>
  )
}

export function WorkoutsCustomExerciseCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.1em] transition-opacity hover:opacity-90 active:scale-[0.99]"
      style={{
        borderColor: WORKOUTS.accent,
        color: WORKOUTS.accent,
        backgroundColor: "transparent",
      }}
    >
      <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      Custom exercise for AI Coach
    </button>
  )
}

export function WorkoutsDetailTopBar({
  onBack,
  favorite,
  onToggleFavorite,
}: {
  onBack: () => void
  favorite?: boolean
  onToggleFavorite?: () => void
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.14em]"
        style={{ color: WORKOUTS.muted }}
        aria-label="Back"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>
      {onToggleFavorite ? (
        <button
          type="button"
          onClick={onToggleFavorite}
          className="flex h-9 w-9 items-center justify-center"
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill={favorite ? WORKOUTS.accent : "none"}
            stroke={favorite ? WORKOUTS.accent : WORKOUTS.muted}
            strokeWidth={2}
            aria-hidden
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ) : (
        <span className="w-9" aria-hidden />
      )}
    </div>
  )
}

export function WorkoutsWithAIBadge({ active = false }: { active?: boolean }) {
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.06em]"
      style={
        active
          ? { backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }
          : {
              backgroundColor: WORKOUTS.iconWell,
              color: WORKOUTS.white,
              border: `1px solid ${WORKOUTS.cardBorder}`,
            }
      }
    >
      With AI
    </span>
  )
}

export function WorkoutsMetricGrid({
  exercises,
  durationMin,
  calories,
}: {
  exercises: number | string
  durationMin: number | string
  calories: number | string
}) {
  const stats = [
    { value: exercises, label: "Exercises" },
    { value: `${durationMin} M`, label: "Duration" },
    { value: calories, label: "Calories" },
  ]

  return (
    <div
      className="mx-4 mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border"
      style={{ backgroundColor: WORKOUTS.card, borderColor: WORKOUTS.cardBorder }}
    >
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="px-2 py-4 text-center"
          style={i < stats.length - 1 ? { borderRight: `1px solid ${WORKOUTS.cardBorder}` } : undefined}
        >
          <span
            className="block text-xl font-black tabular-nums leading-none uppercase"
            style={{ color: WORKOUTS.white, fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
          >
            {stat.value}
          </span>
          <p className="mt-2 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: WORKOUTS.muted }}>
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  )
}

export function WorkoutsStartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-[0.1em] transition-opacity hover:opacity-90 active:scale-[0.98]"
      style={{ backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }}
    >
      <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
      Start workout
    </button>
  )
}

export function WorkoutsBodyCheckBanner({
  onEnable,
  loading,
}: {
  onEnable: () => void
  loading?: boolean
}) {
  return (
    <div
      className="mx-4 mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ backgroundColor: WORKOUTS.card, borderColor: WORKOUTS.cardBorder }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: WORKOUTS.accentDim, border: `1px solid ${WORKOUTS.accentBorder}` }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={WORKOUTS.accent} strokeWidth={2} aria-hidden>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>
      <p className="min-w-0 flex-1 text-xs leading-snug" style={{ color: WORKOUTS.muted }}>
        <span className="font-bold" style={{ color: WORKOUTS.white }}>
          Body check:
        </span>{" "}
        Preview your position with live body tracking
      </p>
      <button
        type="button"
        onClick={onEnable}
        disabled={loading}
        className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] disabled:opacity-50"
        style={{ backgroundColor: WORKOUTS.white, color: "#111111" }}
      >
        {loading ? "…" : "Enable"}
      </button>
    </div>
  )
}
