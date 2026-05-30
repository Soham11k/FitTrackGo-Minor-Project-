"use client"

import { useState, useMemo, useEffect } from "react"
import { Star, Clock, Flame } from "lucide-react"
// ExerciseIllustration used in TrainScreen directly
import { getFavorites, toggleFavorite, getWorkouts, formatErr, getStreak } from "@/lib/store-supabase"
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
import {
  WORKOUTS,
  WorkoutsDetailTopBar,
  WorkoutsDifficultyBadge,
  WorkoutsMetricGrid,
  WorkoutsWithAIBadge,
} from "@/components/workouts/workouts-ui"

type Category = TrainCategory
type DurationFilter = TrainDuration
type SortBy = TrainSort

// categories array moved to TrainScreen

const exercises: ExerciseItem[] = getExercises()

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
  const [streakDays, setStreakDays] = useState(0)

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
      const [favs, workouts, streak] = await Promise.all([getFavorites(), getWorkouts(), getStreak()])
      setFavorites(favs)
      setCompletedTitles(new Set(workouts.map((w) => w.title)))
      setStreakDays(streak)
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
      streakDays={streakDays}
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

  const firstCoachStepIndex = useMemo(() => {
    for (let i = 0; i < exerciseSteps.length; i++) {
      if (getSpecIdForStep(exerciseSteps[i].name)) return i
    }
    return 1
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
    <div className="flex min-h-dvh flex-col pb-28" style={{ backgroundColor: WORKOUTS.bg }}>
      <WorkoutsDetailTopBar onBack={onBack} favorite={isFavorite} onToggleFavorite={onToggleFavorite} />

      <div className="px-5 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <WorkoutsDifficultyBadge level={exercise.difficulty} />
          {lastDone && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.06em]"
              style={{ color: WORKOUTS.white, backgroundColor: WORKOUTS.iconWell }}
            >
              Done before
            </span>
          )}
        </div>
        <h1
          className="mt-4 text-[1.75rem] font-black uppercase leading-tight tracking-tight"
          style={{ fontFamily: "var(--font-display), var(--font-heading), sans-serif", color: WORKOUTS.white }}
        >
          {exercise.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-semibold" style={{ color: WORKOUTS.muted }}>
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> {exercise.duration}
          </span>
          <span className="flex items-center gap-1.5">
            <Flame className="h-4 w-4" /> {exercise.calories} cal
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="h-4 w-4" style={{ color: WORKOUTS.accent }} fill={WORKOUTS.accent} /> {exercise.rating}
          </span>
        </div>
      </div>

      <WorkoutsMetricGrid
        exercises={exercise.exercises}
        duration={String(exercise.durationMin)}
        calories={exercise.calories}
      />

      <div className="px-4 pt-5">
        <ExerciseBodyPreview exerciseId={firstCoachId} theme="workouts" />
      </div>

      <div className="px-4 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: WORKOUTS.muted }}>
            Workout plan
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: WORKOUTS.muted }}>
            {exerciseSteps.length} steps
          </p>
        </div>
        <div className="flex flex-col">
          {exerciseSteps.map((step, i) => {
            const coachId = getSpecIdForStep(step.name)
            const activeStep = i === firstCoachStepIndex
            return (
              <div
                key={`${i}-${step.name}`}
                className="flex items-center gap-4 border-b py-4 last:border-b-0"
                style={{ borderColor: WORKOUTS.cardBorder }}
              >
                <span
                  className="w-8 shrink-0 text-2xl font-black tabular-nums leading-none"
                  style={{ color: activeStep ? WORKOUTS.accent : WORKOUTS.muted }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight" style={{ color: WORKOUTS.white }}>
                    {step.name}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: WORKOUTS.muted }}>{step.reps}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {coachId ? (
                    <WorkoutsWithAIBadge active={activeStep} />
                  ) : (
                    <span className="text-xs font-semibold tabular-nums" style={{ color: WORKOUTS.muted }}>
                      {step.duration}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 pt-6">
        <button
          type="button"
          onClick={handleStartWorkout}
          className="w-full rounded-2xl py-4 text-center text-sm font-black uppercase tracking-[0.1em] transition-opacity hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: WORKOUTS.accent, color: WORKOUTS.white }}
        >
          Start workout
        </button>
      </div>
    </div>
  )
}
