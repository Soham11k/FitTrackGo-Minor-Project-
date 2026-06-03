"use client"

import { motion, useReducedMotion, AnimatePresence } from "framer-motion"
import { Check, Clock, Flame, RefreshCw, Heart } from "lucide-react"
import { ExerciseIllustration, type ExerciseIllustrationId } from "@/components/animated/ExerciseIllustration"
import { staggerDelaySec } from "@/lib/motion"
import type { ExerciseItem } from "@/lib/data"
import type { TabId } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import {
  WORKOUTS,
  WorkoutsDifficultyBadge,
  WorkoutsFilterChip,
  WorkoutsCustomExerciseCta,
} from "@/components/workouts/workouts-ui"

export type TrainCategory = "all" | "strength" | "cardio" | "yoga" | "hiit"
export type TrainDuration = "all" | "short" | "medium" | "long"
export type TrainSort    = "default" | "duration" | "calories" | "rating"

const CATEGORIES: { id: TrainCategory; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "strength", label: "Strength" },
  { id: "cardio",   label: "Cardio" },
  { id: "yoga",     label: "Yoga" },
]

const CAT_ILLUSTRATION: Record<TrainCategory, ExerciseIllustrationId> = {
  all:      "default",
  strength: "squat",
  cardio:   "run",
  yoga:     "yoga",
  hiit:     "high_knees",
}

function chipStyle(active: boolean) {
  return active
    ? { backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }
    : {
        backgroundColor: WORKOUTS.chipInactive,
        color: WORKOUTS.white,
        border: `1px solid ${WORKOUTS.cardBorder}`,
      }
}

export interface TrainScreenProps {
  filtered: ExerciseItem[]
  favorites: number[]
  completedTitles: Set<string>
  initialLoading: boolean
  loadError: string | null
  activeCategory: TrainCategory
  durationFilter: TrainDuration
  sortBy: TrainSort
  showFilters: boolean
  pausedWorkoutTitle?: string | null
  highlightedExerciseId?: number | null
  guest?: boolean
  streakDays?: number
  onSelectExercise: (ex: ExerciseItem) => void
  onToggleFavorite: (e: React.MouseEvent, id: number) => void
  onSetCategory: (c: TrainCategory) => void
  onSetDuration: (d: TrainDuration) => void
  onSetSort: (s: TrainSort) => void
  onToggleFilters: () => void
  onReload: () => void
  onOpenAICoach?: (opts?: { exerciseId?: string }) => void
  onCreateCustomExercise?: () => void
  onResumePaused?: () => void
  onDismissPaused?: () => void
  onNavigate?: (tab: TabId) => void
}

function ExerciseTile({
  ex,
  isCompleted,
  isHighlighted,
  delay,
  onSelect,
}: {
  ex: ExerciseItem
  isCompleted: boolean
  isHighlighted?: boolean
  delay: number
  onSelect: () => void
}) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className="flex cursor-pointer gap-3 rounded-2xl p-3.5"
      style={{
        backgroundColor: WORKOUTS.card,
        border: isHighlighted ? `1px solid ${WORKOUTS.accentBorder}` : `1px solid ${WORKOUTS.cardBorder}`,
        boxShadow: isHighlighted ? "0 0 28px -8px var(--chrome-glow)" : undefined,
      }}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: WORKOUTS.iconWell }}
      >
        <ExerciseIllustration id={CAT_ILLUSTRATION[ex.category as TrainCategory] ?? "default"} size={32} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p
            className="truncate text-[15px] font-bold leading-tight"
            style={{ color: WORKOUTS.white }}
          >
            {ex.title}
          </p>
          {(isCompleted || isHighlighted) && (
            <Check
              className="h-4 w-4 shrink-0"
              style={{ color: WORKOUTS.accent }}
              strokeWidth={3}
              aria-label={isCompleted ? "Completed" : "Selected"}
            />
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: WORKOUTS.muted }}>
            <Clock className="h-3 w-3" aria-hidden /> {ex.durationMin}m
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: WORKOUTS.muted }}>
            <Flame className="h-3 w-3" aria-hidden /> {ex.calories} kcal
          </span>
        </div>
        <div className="mt-2">
          <WorkoutsDifficultyBadge level={ex.difficulty} />
        </div>
      </div>
    </motion.div>
  )
}

export function TrainScreen({
  filtered,
  completedTitles,
  initialLoading,
  loadError,
  activeCategory,
  durationFilter,
  sortBy,
  showFilters,
  pausedWorkoutTitle,
  highlightedExerciseId,
  onSelectExercise,
  onSetCategory,
  onSetDuration,
  onSetSort,
  onReload,
  onCreateCustomExercise,
  onResumePaused,
  onDismissPaused,
}: TrainScreenProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: WORKOUTS.bg }} data-testid="screen-goals">
      <div
        className="px-5 pb-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <motion.h1
          className="text-[2.75rem] font-black uppercase leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif", color: WORKOUTS.white }}
          initial={reduce ? false : { opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          Workouts
        </motion.h1>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => (
            <WorkoutsFilterChip
              key={cat.id}
              label={cat.label}
              active={activeCategory === cat.id}
              onClick={() => onSetCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-28">
        {pausedWorkoutTitle && (
          <div
            className="flex flex-wrap items-center gap-2 rounded-2xl border p-4"
            style={{ backgroundColor: WORKOUTS.card, borderColor: WORKOUTS.accentBorder }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: WORKOUTS.white }}>Paused workout</p>
              <p className="text-xs" style={{ color: WORKOUTS.muted }}>
                Continue &quot;{pausedWorkoutTitle}&quot;
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                style={{ backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }}
                onClick={onResumePaused}
              >
                Resume
              </Button>
              <Button size="sm" variant="ghost" style={{ color: WORKOUTS.muted }} onClick={onDismissPaused}>
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {loadError && (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: WORKOUTS.accentDim, border: `1px solid ${WORKOUTS.accentBorder}` }}
          >
            <p className="min-w-0 flex-1 text-sm" style={{ color: WORKOUTS.accent }}>{loadError}</p>
            <button
              type="button"
              onClick={onReload}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {onCreateCustomExercise && <WorkoutsCustomExerciseCta onClick={onCreateCustomExercise} />}

        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="space-y-3 rounded-2xl border p-4"
              style={{ backgroundColor: WORKOUTS.card, borderColor: WORKOUTS.cardBorder }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: WORKOUTS.muted }}>Duration</p>
              <div className="flex flex-wrap gap-2">
                {(["all", "short", "medium", "long"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSetDuration(d)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={chipStyle(durationFilter === d)}
                  >
                    {d === "all" ? "All" : d === "short" ? "≤25 min" : d === "medium" ? "26–35 min" : "35+ min"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: WORKOUTS.muted }}>Sort</p>
              <div className="flex flex-wrap gap-2">
                {(["default", "duration", "calories", "rating"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetSort(s)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={chipStyle(sortBy === s)}
                  >
                    {s === "default" ? "Featured" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[6.5rem] animate-pulse rounded-2xl"
                style={{ backgroundColor: WORKOUTS.card, opacity: 0.7 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl py-12 text-center"
            style={{ backgroundColor: WORKOUTS.card }}
          >
            <Heart className="h-10 w-10" style={{ color: WORKOUTS.muted }} />
            <p className="text-sm font-semibold" style={{ color: WORKOUTS.muted }}>No workouts match this filter</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((ex, i) => (
              <ExerciseTile
                key={ex.id}
                ex={ex}
                isCompleted={completedTitles.has(ex.title)}
                isHighlighted={highlightedExerciseId === ex.id}
                delay={staggerDelaySec(i, 10, 0.04)}
                onSelect={() => onSelectExercise(ex)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
