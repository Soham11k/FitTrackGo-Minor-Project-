"use client"

import { motion, useReducedMotion, AnimatePresence } from "framer-motion"
import { Clock, Flame, Star, Filter, Target, Wand2, RefreshCw, Heart } from "lucide-react"
import { CHROME } from "@/lib/app-chrome"
import { ChromeHeader } from "@/components/chrome/ChromeHeader"
import { CreamCard } from "@/components/chrome/CreamCard"
import { CategoryChip } from "@/components/chrome/CategoryChip"
import { SectionEyebrow } from "@/components/chrome/SectionEyebrow"
import { HeroAccentLines } from "@/components/animated/HeroAccentLines"
import { ExerciseIllustration, type ExerciseIllustrationId } from "@/components/animated/ExerciseIllustration"
import { staggerDelaySec } from "@/lib/motion"
import type { ExerciseItem } from "@/lib/data"
import type { TabId } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"

// ── Types ──────────────────────────────────────────────────────────────────

export type TrainCategory = "all" | "strength" | "cardio" | "yoga" | "hiit"
export type TrainDuration = "all" | "short" | "medium" | "long"
export type TrainSort    = "default" | "duration" | "calories" | "rating"

const CATEGORIES: { id: TrainCategory; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "strength", label: "Strength" },
  { id: "cardio",   label: "Cardio" },
  { id: "yoga",     label: "Yoga" },
  { id: "hiit",     label: "HIIT" },
]

const CAT_ILLUSTRATION: Record<TrainCategory, ExerciseIllustrationId> = {
  all:      "default",
  strength: "squat",
  cardio:   "run",
  yoga:     "yoga",
  hiit:     "high_knees",
}

const CAT_ACCENT: Record<TrainCategory, string> = {
  all:      CHROME.orange,
  strength: CHROME.orange,
  cardio:   CHROME.hrRed,
  yoga:     CHROME.teal,
  hiit:     "#facc15",
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

// ── Sub-components ─────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: string }) {
  const color =
    level === "Beginner"     ? CHROME.gpsGreen :
    level === "Intermediate" ? CHROME.amber     :
    level === "Advanced"     ? CHROME.hrRed     : CHROME.muted

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}20` }}
    >
      {level}
    </span>
  )
}

function ExerciseTile({
  ex,
  isFavorite,
  isCompleted,
  delay,
  onSelect,
  onToggleFav,
}: {
  ex: ExerciseItem
  isFavorite: boolean
  isCompleted: boolean
  delay: number
  onSelect: () => void
  onToggleFav: (e: React.MouseEvent) => void
}) {
  const reduce = useReducedMotion() ?? false
  const accent = CAT_ACCENT[ex.category as TrainCategory] ?? CHROME.orange

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className="flex cursor-pointer items-center gap-3 rounded-[1.2rem] border p-3"
      style={{ backgroundColor: CHROME.card, borderColor: CHROME.cardBorder }}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
    >
      {/* Illustration */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: `${accent}18` }}
      >
        <ExerciseIllustration id={CAT_ILLUSTRATION[ex.category as TrainCategory] ?? "default"} size={36} />
        {/* Category accent dot */}
        <span
          className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold" style={{ color: CHROME.text }}>
            {ex.title}
          </p>
          {isCompleted && (
            <span className="text-[10px] font-semibold" style={{ color: CHROME.gpsGreen }}>✓</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px]" style={{ color: CHROME.muted }}>
            <Clock className="h-3 w-3" /> {ex.durationMin}m
          </span>
          <span className="flex items-center gap-1 text-[10px]" style={{ color: CHROME.muted }}>
            <Flame className="h-3 w-3" /> {ex.calories} kcal
          </span>
          <DifficultyBadge level={ex.difficulty} />
        </div>
      </div>

      {/* Favourite */}
      <button
        type="button"
        onClick={onToggleFav}
        className="shrink-0 p-1"
        aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
      >
        <Star
          className="h-4 w-4"
          style={{ color: isFavorite ? CHROME.orange : CHROME.muted }}
          fill={isFavorite ? CHROME.orange : "none"}
        />
      </button>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function TrainScreen({
  filtered,
  favorites,
  completedTitles,
  initialLoading,
  loadError,
  activeCategory,
  durationFilter,
  sortBy,
  showFilters,
  pausedWorkoutTitle,
  guest,
  streakDays = 0,
  onSelectExercise,
  onToggleFavorite,
  onSetCategory,
  onSetDuration,
  onSetSort,
  onToggleFilters,
  onReload,
  onOpenAICoach,
  onCreateCustomExercise,
  onResumePaused,
  onDismissPaused,
}: TrainScreenProps) {
  const reduce = useReducedMotion() ?? false
  const accent = CAT_ACCENT[activeCategory]

  return (
    <div className="flex min-h-dvh flex-col" style={{ backgroundColor: CHROME.cream }}>
      {/* Chrome header */}
      <ChromeHeader guest={guest} streakDays={streakDays} />

      {/* Dark hero section */}
      <div
        className="relative overflow-hidden px-5 pb-6 pt-4"
        style={{ backgroundColor: CHROME.black }}
      >
        <HeroAccentLines height={140} strokeColor={CHROME.border} />

        {/* Illustration + pulsing glow */}
        <div className="relative z-10 flex items-center gap-5">
          <div className="relative">
            {!reduce && (
              <motion.div
                className="absolute inset-0 rounded-2xl"
                style={{ backgroundColor: `${accent}25` }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div
              className="relative flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${accent}20`, border: `1px solid ${accent}40` }}
            >
              <ExerciseIllustration
                id={CAT_ILLUSTRATION[activeCategory]}
                size={52}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>
              Train
            </p>
            <motion.h1
              className="text-4xl font-black uppercase leading-none text-white"
              style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeCategory === "all" ? "Library" : CATEGORIES.find(c => c.id === activeCategory)?.label ?? "Library"}
            </motion.h1>
            <p className="mt-1 text-sm font-semibold" style={{ color: CHROME.muted }}>
              {filtered.length} workouts
            </p>
          </div>

          {/* Controls */}
          <div className="ml-auto flex items-center gap-2">
            {onOpenAICoach && (
              <button
                type="button"
                onClick={() => onOpenAICoach()}
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${CHROME.teal}22`, border: `1px solid ${CHROME.teal}40` }}
                aria-label="Open AI Coach"
              >
                <Target className="h-4 w-4" style={{ color: CHROME.teal }} />
              </button>
            )}
            <button
              type="button"
              onClick={onToggleFilters}
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: CHROME.cardBg, border: `1px solid ${CHROME.border}` }}
              aria-label="Filters"
            >
              <Filter className="h-4 w-4" style={{ color: showFilters ? CHROME.orange : CHROME.muted }} />
            </button>
          </div>
        </div>

        {/* Category chip rail */}
        <div className="relative z-10 mt-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={cat.label}
              active={activeCategory === cat.id}
              color={CAT_ACCENT[cat.id]}
              onClick={() => onSetCategory(cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-28">
        {/* Paused workout banner */}
        {pausedWorkoutTitle && (
          <CreamCard delay={0} className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: CHROME.text }}>Paused workout</p>
              <p className="text-xs" style={{ color: CHROME.muted }}>
                Continue &quot;{pausedWorkoutTitle}&quot;
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" style={{ backgroundColor: CHROME.orange, color: CHROME.white }} onClick={onResumePaused}>
                Resume
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismissPaused}>Dismiss</Button>
            </div>
          </CreamCard>
        )}

        {/* Load error */}
        {loadError && (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ backgroundColor: `${CHROME.hrRed}15`, border: `1px solid ${CHROME.hrRed}30` }}
          >
            <p className="min-w-0 flex-1 text-sm" style={{ color: CHROME.hrRed }}>{loadError}</p>
            <button
              type="button"
              onClick={onReload}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold"
              style={{ backgroundColor: `${CHROME.hrRed}25`, color: CHROME.hrRed }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Custom exercise CTA */}
        {onCreateCustomExercise && (
          <button
            type="button"
            onClick={onCreateCustomExercise}
            className="flex w-full items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-3 text-sm font-semibold transition-colors"
            style={{ borderColor: `${CHROME.orange}50`, color: CHROME.orange }}
          >
            <Wand2 className="h-4 w-4" />
            Create custom exercise for AI Coach
          </button>
        )}

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="space-y-3 rounded-2xl p-4"
              style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: CHROME.muted }}>Duration</p>
              <div className="flex flex-wrap gap-2">
                {(["all", "short", "medium", "long"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => onSetDuration(d)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={
                      durationFilter === d
                        ? { backgroundColor: CHROME.orange, color: CHROME.white }
                        : { backgroundColor: CHROME.cream, color: CHROME.muted, border: `1px solid ${CHROME.cardBorder}` }
                    }
                  >
                    {d === "all" ? "All" : d === "short" ? "≤25 min" : d === "medium" ? "26–35 min" : "35+ min"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: CHROME.muted }}>Sort</p>
              <div className="flex flex-wrap gap-2">
                {(["default", "duration", "calories", "rating"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onSetSort(s)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={
                      sortBy === s
                        ? { backgroundColor: CHROME.orange, color: CHROME.white }
                        : { backgroundColor: CHROME.cream, color: CHROME.muted, border: `1px solid ${CHROME.cardBorder}` }
                    }
                  >
                    {s === "default" ? "Featured" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exercise list */}
        {initialLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-[1.2rem]"
                style={{ backgroundColor: CHROME.card, opacity: 0.7 }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-2xl py-12 text-center"
            style={{ backgroundColor: CHROME.card, border: `1px solid ${CHROME.cardBorder}` }}
          >
            <Heart className="h-10 w-10" style={{ color: CHROME.muted }} />
            <p className="text-sm font-semibold" style={{ color: CHROME.muted }}>No workouts match this filter</p>
          </div>
        ) : (
          <>
            <SectionEyebrow>Workouts</SectionEyebrow>
            <div className="space-y-2.5">
              {filtered.map((ex, i) => (
                <ExerciseTile
                  key={ex.id}
                  ex={ex}
                  isFavorite={favorites.includes(ex.id)}
                  isCompleted={completedTitles.has(ex.title)}
                  delay={staggerDelaySec(i, 10, 0.04)}
                  onSelect={() => onSelectExercise(ex)}
                  onToggleFav={(e) => onToggleFavorite(e, ex.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
