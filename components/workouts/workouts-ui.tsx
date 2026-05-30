"use client"

import { ChevronLeft, ChevronRight, Flame, Sparkles } from "lucide-react"
import { EcgMark } from "@/components/chrome/EcgMark"
import { WORKOUTS, difficultyStyle } from "@/lib/workouts-theme"

export { WORKOUTS }

export function WorkoutsHeader({
  guest,
  streakDays = 0,
}: {
  guest?: boolean
  streakDays?: number
}) {
  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{
        backgroundColor: WORKOUTS.black,
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
      }}
    >
      <div className="flex items-center gap-1.5">
        <EcgMark size={14} animate color={WORKOUTS.accent} />
        <span
          className="text-[11px] font-black uppercase tracking-[0.28em]"
          style={{ color: WORKOUTS.white }}
        >
          FitTrack
        </span>
      </div>
      <div className="flex items-center gap-2">
        {guest && (
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: WORKOUTS.muted }}>
            Guest
          </span>
        )}
        {streakDays > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-white"
            style={{ backgroundColor: WORKOUTS.accent }}
          >
            <Flame className="h-3 w-3" aria-hidden />
            {streakDays}D Streak
          </span>
        )}
      </div>
    </header>
  )
}

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
      className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.06em]"
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

export function WorkoutsSectionLabel({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-1">
      <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: WORKOUTS.muted }}>
        Workouts
      </p>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: WORKOUTS.muted }}>
        {count} total
      </p>
    </div>
  )
}

export function WorkoutsAICard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full overflow-hidden rounded-2xl px-4 py-4 text-left transition-opacity hover:opacity-95 active:scale-[0.99]"
      style={{
        backgroundColor: WORKOUTS.accentBanner,
        border: `1px solid ${WORKOUTS.accentBorder}`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,59,48,0.25) 0%, transparent 45%), repeating-linear-gradient(45deg, rgba(255,59,48,0.06) 0 2px, transparent 2px 14px)",
        }}
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: WORKOUTS.accent }} aria-hidden />
        <span
          className="min-w-0 flex-1 text-[11px] font-black uppercase leading-snug tracking-[0.1em]"
          style={{ color: WORKOUTS.white }}
        >
          Create custom exercise for AI Coach
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" style={{ color: WORKOUTS.muted }} aria-hidden />
      </div>
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
    <div className="flex items-center justify-between px-4 py-3">
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
  duration,
  calories,
}: {
  exercises: number | string
  duration: string
  calories: number | string
}) {
  const stats = [
    { value: exercises, label: "Exercises" },
    { value: duration, label: "Minutes" },
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
            className="block text-xl font-black tabular-nums leading-none"
            style={{ color: WORKOUTS.white }}
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
