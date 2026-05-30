"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronRight, Star, Clock, Flame, Dumbbell, Heart, Zap, Target } from "lucide-react"
// ExerciseIllustration used in TrainScreen directly
import { getFavorites, toggleFavorite, getWorkouts, formatErr } from "@/lib/store-supabase"
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
import { TrainScreen } from "@/components/train-screen"
import type { TrainCategory, TrainDuration, TrainSort } from "@/components/train-screen"

type Category = TrainCategory
type DurationFilter = TrainDuration
type SortBy = TrainSort

// categories array moved to TrainScreen

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

// categoryToIllustration moved to TrainScreen

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
    <TrainScreen
      filtered={filtered}
      favorites={favorites}
      completedTitles={completedTitles}
      initialLoading={initialLoading}
      loadError={loadError}
      activeCategory={activeCategory}
      durationFilter={durationFilter}
      sortBy={sortBy}
      showFilters={showFilters}
      pausedWorkoutTitle={pausedWorkoutSnapshot?.exercise?.title ?? null}
      onSelectExercise={setSelectedExercise}
      onToggleFavorite={handleToggleFavorite}
      onSetCategory={setActiveCategory}
      onSetDuration={setDurationFilter}
      onSetSort={setSortBy}
      onToggleFilters={() => setShowFilters((v) => !v)}
      onReload={loadFavoritesAndWorkouts}
      onOpenAICoach={onOpenAICoach}
      onCreateCustomExercise={onCreateCustomExercise}
      onResumePaused={continuePausedBanner}
      onDismissPaused={dismissPausedBanner}
      onNavigate={onNavigate}
    />
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
