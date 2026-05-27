"use client"

import { useState, useMemo, useEffect } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Clock, Flame, ChevronRight, Play, Star, Filter, Dumbbell, Heart, Zap, RefreshCw, Target, Wand2 } from "lucide-react"
import { ExerciseIllustration, type ExerciseIllustrationId } from "@/components/animated/ExerciseIllustration"
import { getFavorites, toggleFavorite, getWorkouts, formatErr } from "@/lib/store-supabase"
import { CINEMATIC, staggerChildren } from "@/lib/motion"
import { pulse } from "@/lib/haptics"
import { getExercises, type ExerciseItem } from "@/lib/data"
import { getSpecIdForStep } from "@/lib/exercise-ai-map"
import { WorkoutPlayer } from "@/components/workout-player"
import {
  clearWorkoutSessionSnapshot,
  readWorkoutSessionSnapshot,
} from "@/lib/workout-session-snapshot"
import { ExerciseBodyPreview } from "@/components/exercise-body-preview"
import { toast } from "sonner"
import type { TabId } from "@/components/bottom-nav"
import { Button } from "@/components/ui/button"
import { EditorialEmpty } from "@/components/brand/editorial-empty"
import { InlineScreenSkeleton } from "@/components/brand/inline-screen-skeleton"

type Category = "all" | "strength" | "cardio" | "yoga" | "hiit"
type DurationFilter = "all" | "short" | "medium" | "long"
type SortBy = "default" | "duration" | "calories" | "rating"

const categories: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "strength", label: "Strength" },
  { id: "cardio", label: "Cardio" },
  { id: "yoga", label: "Yoga" },
  { id: "hiit", label: "HIIT" },
]

const exercises: ExerciseItem[] = getExercises()

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Beginner: "bg-chart-2/15 text-chart-2",
    Intermediate: "bg-chart-4/15 text-chart-4",
    Advanced: "bg-destructive/15 text-destructive",
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-typo-eyebrow font-semibold ${colors[level] || "bg-secondary text-muted-foreground"}`}>
      {level}
    </span>
  )
}

const categoryMetricTint: Record<Category, string> = {
  all:      "from-primary/55 via-metric-run/30 to-metric-run/10",
  strength: "from-metric-move/65 to-metric-move/25",
  cardio:   "from-metric-run/65 to-metric-run/25",
  yoga:     "from-metric-coach/60 to-metric-coach/20",
  hiit:     "from-metric-hr/60 to-metric-hr/20",
}

const categoryIcons: Record<Category, typeof Dumbbell> = {
  all: Dumbbell,
  strength: Dumbbell,
  cardio: Flame,
  yoga: Heart,
  hiit: Zap,
}

const categoryToIllustration: Record<Category, ExerciseIllustrationId> = {
  all:      "default",
  strength: "squat",
  cardio:   "run",
  yoga:     "yoga",
  hiit:     "high_knees",
}

export function ExerciseLibrary({
  onOpenAICoach,
  onNavigate,
  onCreateCustomExercise,
}: {
  onOpenAICoach?: (opts?: { exerciseId?: string }) => void
  onNavigate?: (tab: TabId) => void
  onCreateCustomExercise?: () => void
} = {}) {
  const [activeCategory, setActiveCategory] = useState<Category>("all")
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("default")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<(typeof exercises)[0] | null>(null)
  const [favorites, setFavorites] = useState<number[]>([])
  const [completedTitles, setCompletedTitles] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [pausedWorkoutSnapshot, setPausedWorkoutSnapshot] = useState(
    (): ReturnType<typeof readWorkoutSessionSnapshot> =>
      typeof window !== "undefined" ? readWorkoutSessionSnapshot() : null,
  )
  const [preferResumeForExerciseId, setPreferResumeForExerciseId] = useState<number | null>(null)

  const dismissPausedBanner = () => {
    clearWorkoutSessionSnapshot()
    setPausedWorkoutSnapshot(null)
  }

  const continuePausedBanner = () => {
    const s = pausedWorkoutSnapshot ?? readWorkoutSessionSnapshot()
    if (!s) return
    const match = exercises.find((e) => e.id === s.exerciseId)
    if (!match) return
    setPreferResumeForExerciseId(s.exerciseId)
    setSelectedExercise(match)
  }

  const loadFavoritesAndWorkouts = async () => {
    setLoadError(null)
    try {
      const [favs, workouts] = await Promise.all([getFavorites(), getWorkouts()])
      setFavorites(favs)
      setCompletedTitles(new Set(workouts.map((w) => w.title)))
    } catch (error) {
      const msg = formatErr(error)
      setLoadError(msg)
      console.error("Failed to load favorites/workouts:", msg)
    } finally {
      setInitialLoading(false)
    }
  }

  useEffect(() => {
    loadFavoritesAndWorkouts()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (selectedExercise) return
    setPausedWorkoutSnapshot(readWorkoutSessionSnapshot())
  }, [selectedExercise])

  const filtered = useMemo(() => {
    let list = activeCategory === "all" ? exercises : exercises.filter((e) => e.category === activeCategory)
    if (durationFilter === "short") list = list.filter((e) => e.durationMin <= 25)
    if (durationFilter === "medium") list = list.filter((e) => e.durationMin > 25 && e.durationMin <= 35)
    if (durationFilter === "long") list = list.filter((e) => e.durationMin > 35)
    if (sortBy === "duration") list = [...list].sort((a, b) => a.durationMin - b.durationMin)
    if (sortBy === "calories") list = [...list].sort((a, b) => b.calories - a.calories)
    if (sortBy === "rating") list = [...list].sort((a, b) => b.rating - a.rating)
    return list
  }, [activeCategory, durationFilter, sortBy])

  const featured = filtered[0] ?? exercises[0]

  const handleToggleFavorite = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      const wasFavorite = favorites.includes(id)
      await toggleFavorite(id)
      const updated = await getFavorites()
      setFavorites(updated)
      if (!wasFavorite) pulse("celebrate")
      toast.success(wasFavorite ? "Removed from favorites" : "Added to favorites")
    } catch (error) {
      toast.error("Failed to update favorites")
      console.error(error)
    }
  }

  if (selectedExercise) {
    return (
      <ExerciseDetail
        exercise={selectedExercise}
        onBack={() => {
          setSelectedExercise(null)
          setPreferResumeForExerciseId(null)
        }}
        isFavorite={favorites.includes(selectedExercise.id)}
        onToggleFavorite={async () => {
          try {
            const was = favorites.includes(selectedExercise.id)
            await toggleFavorite(selectedExercise.id)
            const updated = await getFavorites()
            setFavorites(updated)
            toast.success(was ? "Removed from favorites" : "Added to favorites")
          } catch (error) {
            toast.error("Failed to update favorites")
            console.error(error)
          }
        }}
        lastDone={completedTitles.has(selectedExercise.title)}
        onOpenAICoach={onOpenAICoach}
        preferResumePlayback={preferResumeForExerciseId === selectedExercise.id}
        onPreferResumeConsumed={() => setPreferResumeForExerciseId(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 bg-background px-4 pt-4 pb-28">
      {pausedWorkoutSnapshot?.exercise && (
        <div className="flex flex-wrap items-start gap-2 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 text-sm dark:bg-primary/10">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Paused workout</p>
            <p className="text-xs text-muted-foreground">
              Continue &quot;{pausedWorkoutSnapshot.exercise.title}&quot; · step {pausedWorkoutSnapshot.index + 1}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" size="sm" className="h-9" onClick={() => void continuePausedBanner()}>
              Resume
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={dismissPausedBanner}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
      {loadError && (
        <div className="rounded-xl bg-destructive/10 text-destructive border border-destructive/20 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm flex-1 min-w-0">{loadError}</p>
          <button
            type="button"
            onClick={loadFavoritesAndWorkouts}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-destructive/20 px-3 py-1.5 text-sm font-medium hover:bg-destructive/30"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}
      {onCreateCustomExercise ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 border-dashed border-primary/40"
          onClick={onCreateCustomExercise}
        >
          <Wand2 className="h-4 w-4 text-primary" />
          Create custom exercise for AI Coach
        </Button>
      ) : null}
      <motion.section
        variants={CINEMATIC.heroEnter}
        initial="hidden"
        animate="show"
        className="nrc-card flex flex-col gap-4 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-eyebrow-mega text-muted-foreground/85">Train</p>
            <h1
              className="text-display-stat-lg mt-1 text-foreground"
              style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif" }}
            >
              {(activeCategory === "all" ? "Library" : categories.find((c) => c.id === activeCategory)?.label ?? "Library").toUpperCase()}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{filtered.length} workouts</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onOpenAICoach && (
              <button
                type="button"
                onClick={() => onOpenAICoach()}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-metric-coach/35 bg-metric-coach/15"
                aria-label="Open AI Coach"
              >
                <Target className="h-4 w-4 text-metric-coach" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
              aria-label="Filters"
            >
              <Filter className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </motion.section>

      {showFilters && (
        <div className="rounded-2xl bg-card p-4 border border-border space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Duration</p>
          <div className="flex gap-2 flex-wrap">
            {(["all", "short", "medium", "long"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  durationFilter === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {d === "all" ? "All" : d === "short" ? "≤25 min" : d === "medium" ? "26–35 min" : "35+ min"}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">Sort</p>
          <div className="flex gap-2 flex-wrap">
            {(["default", "duration", "calories", "rating"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  sortBy === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {s === "default" ? "Default" : s === "duration" ? "Duration" : s === "calories" ? "Calories" : "Rating"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="-mx-4 border-y border-border px-4">
        <div className="flex gap-0 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`relative shrink-0 border-r border-border px-4 py-3 text-typo-eyebrow font-bold uppercase tracking-[0.2em] transition-colors last:border-r-0 ${
                activeCategory === cat.id
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
              {activeCategory === cat.id && (
                <motion.div
                  layoutId="ex-cat-underline"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <article className="relative overflow-hidden rounded-2xl border border-border/60 text-left shadow-sm">
        <button
          type="button"
          aria-label={`Open workout: ${featured.title}`}
          className="absolute inset-0 z-[1] cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          onClick={() => setSelectedExercise(featured)}
        />
        <div className={`relative z-0 pointer-events-none h-48 w-full bg-gradient-to-br ${categoryMetricTint[featured.category]} flex items-center justify-center`}>
          <ExerciseIllustration
            id={categoryToIllustration[featured.category as Category] ?? "default"}
            size={96}
            animate
            color="rgba(255,255,255,0.75)"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute top-3 right-3 z-20">
          <button
            type="button"
            onClick={(e) => handleToggleFavorite(e, featured.id)}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={
              favorites.includes(featured.id)
                ? `Unfavorite ${featured.title}`
                : `Favorite ${featured.title}`
            }
          >
            <Star className={`h-4 w-4 ${favorites.includes(featured.id) ? "fill-chart-4 text-chart-4" : "text-muted-foreground"}`} />
          </button>
        </div>
        <div className="pointer-events-none relative z-0 p-5 pb-14">
          <DifficultyBadge level={featured.difficulty} />
          <h3 className="mt-2 text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {featured.title}
          </h3>
          <div className="mt-1 flex items-end gap-3">
            <div className="flex items-baseline gap-1">
              <span
                className="text-2xl font-bold tabular-nums text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {featured.durationMin}
              </span>
              <span className="text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-muted-foreground">
                min
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                className="text-2xl font-bold tabular-nums text-metric-hr"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {featured.calories}
              </span>
              <span className="text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-muted-foreground">
                kcal
              </span>
            </div>
            <span className="ml-auto flex items-center gap-1 text-xs font-semibold tabular-nums text-metric-streak">
              <Star className="h-3.5 w-3.5" fill="currentColor" />
              {featured.rating}
            </span>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-5 right-5 z-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
        </div>
      </article>

      <motion.div
        className="grid grid-cols-2 gap-3"
        variants={staggerChildren(0.06, 0.05)}
        initial="hidden"
        animate="show"
      >
        {initialLoading ? (
          <InlineScreenSkeleton
            label="Loading exercise library…"
            hint="Curating movement plans and Coach-ready drills."
            layout="list"
            className="col-span-2 border-0 bg-transparent p-0 shadow-none"
          />
        ) : filtered.length === 0 ? (
          <div className="col-span-2">
          <EditorialEmpty
            title="No moves match yet"
            description="Loosen filters to see workouts, or open Coach for guided form drills."
            media={
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src="/illustrations/exercises-empty.svg"
                alt=""
                className="h-[7rem] w-[7rem] opacity-90"
              />
            }
            secondary={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    setActiveCategory("all")
                    setDurationFilter("all")
                    setSortBy("default")
                    setShowFilters(false)
                  }}
                >
                  Clear filters
                </Button>
                {onNavigate ? (
                  <Button type="button" className="rounded-full" onClick={() => onNavigate("ai-coach")}>
                    Open Coach
                  </Button>
                ) : (
                  <Button type="button" className="rounded-full" onClick={() => onOpenAICoach?.()}>
                    Open Coach
                  </Button>
                )}
              </div>
            }
          />
          </div>
        ) : (
          filtered.map((exercise) => (
            <motion.div key={exercise.id} variants={CINEMATIC.statReveal} className="min-w-0">
              <article className="nrc-card relative flex h-full flex-col overflow-hidden p-0">
                <button
                  type="button"
                  className="flex flex-1 flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  onClick={() => setSelectedExercise(exercise)}
                >
                  <div
                    className={`flex h-24 w-full items-center justify-center bg-gradient-to-br ${categoryMetricTint[exercise.category as Category]}`}
                  >
                    <ExerciseIllustration
                      id={categoryToIllustration[exercise.category as Category] ?? "default"}
                      size={56}
                      animate={false}
                      color="rgba(255,255,255,0.8)"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DifficultyBadge level={exercise.difficulty} />
                      <span className="rounded-sm border border-border px-1.5 py-0.5 text-typo-micro font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        {exercise.durationMin}m
                      </span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{exercise.title}</h3>
                    <p className="line-clamp-1 text-typo-caption capitalize text-muted-foreground">{exercise.category}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="text-typo-micro font-bold uppercase tracking-[0.16em] text-metric-hr tabular-nums">
                        {exercise.calories} kcal
                      </span>
                      {completedTitles.has(exercise.title) ? (
                        <span className="text-typo-micro font-bold uppercase text-metric-move">Done</span>
                      ) : null}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90"
                  onClick={(e) => handleToggleFavorite(e, exercise.id)}
                  aria-label={
                    favorites.includes(exercise.id)
                      ? `Unfavorite ${exercise.title}`
                      : `Favorite ${exercise.title}`
                  }
                >
                  <Star className={`h-3.5 w-3.5 ${favorites.includes(exercise.id) ? "fill-metric-streak text-metric-streak" : "text-muted-foreground"}`} />
                </button>
              </article>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  )
}

/* Exercise Detail Subscreen */
function ExerciseDetail({
  exercise,
  onBack,
  isFavorite,
  onToggleFavorite,
  lastDone,
  onOpenAICoach,
  preferResumePlayback = false,
  onPreferResumeConsumed,
}: {
  exercise: (typeof exercises)[0]
  onBack: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
  lastDone: boolean
  onOpenAICoach?: (opts?: { exerciseId?: string }) => void
  preferResumePlayback?: boolean
  onPreferResumeConsumed?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [playbackResume, setPlaybackResume] = useState(false)

  const exerciseSteps = useMemo(
    () =>
      exercise.steps && exercise.steps.length > 0
        ? exercise.steps
        : [
            { name: "Warm up", duration: "3 min", reps: "Dynamic stretches" },
            { name: exercise.title, duration: `${exercise.durationMin} min`, reps: "Steady pace" },
            { name: "Cool down", duration: "3 min", reps: "Stretching" },
          ],
    [exercise]
  )

  const firstCoachId = useMemo(() => {
    for (const step of exerciseSteps) {
      const id = getSpecIdForStep(step.name)
      if (id) return id
    }
    return null
  }, [exerciseSteps])

  useEffect(() => {
    if (!preferResumePlayback) return
    const s = readWorkoutSessionSnapshot()
    if (!s || s.exerciseId !== exercise.id) {
      onPreferResumeConsumed?.()
      return
    }
    setPlaybackResume(true)
    setPlaying(true)
    onPreferResumeConsumed?.()
  }, [preferResumePlayback, exercise.id, onPreferResumeConsumed])

  if (playing) {
    return (
      <WorkoutPlayer
        exercise={exercise}
        resume={playbackResume}
        onExit={(completed) => {
          setPlaying(false)
          setPlaybackResume(false)
          if (completed) onBack()
        }}
      />
    )
  }

  const handleStartWorkout = () => {
    setPlaybackResume(false)
    setPlaying(true)
  }

  return (
    <div className="flex flex-col pb-28">
      <div className="relative h-64 overflow-hidden">
        <div className={`h-full w-full bg-gradient-to-br flex items-center justify-center ${categoryMetricTint[exercise.category]}`}>
          {(() => { const Icon = categoryIcons[exercise.category]; return <Icon className="h-20 w-20 text-white/75" /> })()}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <button onClick={onBack} className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-foreground" aria-label="Back">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <button onClick={onToggleFavorite} className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm">
          <Star className={`h-5 w-5 ${isFavorite ? "fill-chart-4 text-chart-4" : "text-muted-foreground"}`} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-2">
            <DifficultyBadge level={exercise.difficulty} />
            {lastDone && <span className="rounded-full px-2 py-0.5 text-typo-eyebrow font-semibold bg-primary/15 text-primary">Done before</span>}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{exercise.title}</h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {exercise.duration}</span>
            <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> {exercise.calories} cal</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-chart-4" fill="currentColor" /> {exercise.rating}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 px-4 pt-5">
        <div className="rounded-xl bg-card p-3 border border-border text-center">
          <span className="text-lg font-bold text-foreground">{exercise.exercises}</span>
          <p className="text-typo-eyebrow text-muted-foreground uppercase">Exercises</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border text-center">
          <span className="text-lg font-bold text-foreground">{exercise.duration}</span>
          <p className="text-typo-eyebrow text-muted-foreground uppercase">Duration</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border text-center">
          <span className="text-lg font-bold text-foreground">{exercise.calories}</span>
          <p className="text-typo-eyebrow text-muted-foreground uppercase">Calories</p>
        </div>
      </div>
      <div className="px-4 pt-5">
        <ExerciseBodyPreview exerciseId={firstCoachId} />
      </div>
      <div className="px-4 pt-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Workout Plan</h2>
        <div className="flex flex-col gap-2">
          {exerciseSteps.map((step, i) => {
            const coachId = getSpecIdForStep(step.name)
            return (
            <div key={`${i}-${step.name}`} className="flex items-center gap-3 rounded-xl bg-card p-3 border border-border">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{step.name}</p>
                <p className="text-xs text-muted-foreground">{step.reps}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {coachId && onOpenAICoach && (
                  <button
                    type="button"
                    onClick={() => onOpenAICoach({ exerciseId: coachId })}
                    className="rounded-lg border border-metric-coach/30 bg-metric-coach/10 px-2.5 py-1 text-typo-eyebrow font-bold uppercase tracking-wide text-metric-coach hover:bg-metric-coach/20"
                  >
                    Practice with AI
                  </button>
                )}
                <span className="text-xs text-muted-foreground tabular-nums">{step.duration}</span>
              </div>
            </div>
            )
          })}
        </div>
      </div>
      <div className="px-4 pt-5 flex flex-col gap-3">
        {onOpenAICoach && (
          <button
            type="button"
            onClick={() => onOpenAICoach(firstCoachId ? { exerciseId: firstCoachId } : undefined)}
            className="w-full rounded-xl border border-metric-coach/35 bg-metric-coach/10 py-3.5 text-center font-semibold text-metric-coach text-base transition-all hover:bg-metric-coach/15 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Target className="h-4 w-4 shrink-0" />
            Open AI Coach
          </button>
        )}
        <button
          type="button"
          onClick={handleStartWorkout}
          className="w-full rounded-xl bg-primary py-4 text-center font-semibold text-primary-foreground text-base transition-all hover:bg-primary/90 active:scale-[0.98]"
        >
          Start Workout
        </button>
      </div>
    </div>
  )
}
