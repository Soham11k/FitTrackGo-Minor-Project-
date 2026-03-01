"use client"

import { useState, useMemo, useEffect } from "react"
import { Clock, Flame, ChevronRight, Play, Star, Filter, Dumbbell, Heart, Zap, RefreshCw } from "lucide-react"
import { getFavorites, toggleFavorite, addWorkout, getWorkouts, formatErr } from "@/lib/store-supabase"
import { getExercises, type ExerciseItem } from "@/lib/data"
import { toast } from "sonner"

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
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors[level] || "bg-secondary text-muted-foreground"}`}>
      {level}
    </span>
  )
}

const categoryGradients: Record<Category, string> = {
  all: "from-primary/30 to-chart-2/30",
  strength: "from-primary/30 to-primary/10",
  cardio: "from-destructive/20 to-chart-2/20",
  yoga: "from-chart-2/30 to-chart-4/20",
  hiit: "from-chart-4/30 to-destructive/20",
}

const categoryIcons: Record<Category, typeof Dumbbell> = {
  all: Dumbbell,
  strength: Dumbbell,
  cardio: Flame,
  yoga: Heart,
  hiit: Zap,
}

export function ExerciseLibrary() {
  const [activeCategory, setActiveCategory] = useState<Category>("all")
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("default")
  const [showFilters, setShowFilters] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<(typeof exercises)[0] | null>(null)
  const [favorites, setFavorites] = useState<number[]>([])
  const [completedTitles, setCompletedTitles] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

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
    }
  }

  useEffect(() => {
    loadFavoritesAndWorkouts()
  }, [])

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
        onBack={() => setSelectedExercise(null)}
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
      />
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            Exercises
          </h1>
          <p className="text-sm text-muted-foreground">{filtered.length} workouts</p>
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border"
          aria-label="Filters"
        >
          <Filter className="h-4 w-4 text-muted-foreground" />
        </button>
      </header>

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

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedExercise(featured)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedExercise(featured) } }}
        className="relative overflow-hidden rounded-2xl text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className={`h-48 w-full bg-gradient-to-br ${categoryGradients[featured.category]} flex items-center justify-center`}>
          {(() => { const Icon = categoryIcons[featured.category]; return <Icon className="h-16 w-16 text-white/40" /> })()}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute top-3 right-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(e, featured.id) }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm"
            aria-label={favorites.includes(featured.id) ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`h-4 w-4 ${favorites.includes(featured.id) ? "fill-chart-4 text-chart-4" : "text-muted-foreground"}`} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <DifficultyBadge level={featured.difficulty} />
          <h3 className="mt-2 text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {featured.title}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {featured.duration}</span>
            <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> {featured.calories} cal</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 text-chart-4" fill="currentColor" /> {featured.rating}</span>
          </div>
        </div>
        <div className="absolute right-4 bottom-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No exercises found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filtered.map((exercise) => (
          <div
            key={exercise.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedExercise(exercise)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setSelectedExercise(exercise)
              }
            }}
            className="flex items-center gap-4 rounded-2xl bg-card p-3 border border-border text-left transition-all hover:border-primary/30 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className={`h-20 w-20 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ${categoryGradients[exercise.category]}`}>
              {(() => { const Icon = categoryIcons[exercise.category]; return <Icon className="h-8 w-8 text-white/50" /> })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DifficultyBadge level={exercise.difficulty} />
                {completedTitles.has(exercise.title) && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary">Done</span>
                )}
              </div>
              <h3 className="mt-1 text-sm font-semibold text-foreground truncate">{exercise.title}</h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exercise.duration}</span>
                <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> {exercise.calories} cal</span>
              </div>
            </div>
            <button
              onClick={(e) => handleToggleFavorite(e, exercise.id)}
              className="p-2 shrink-0 rounded-full hover:bg-secondary"
            >
              <Star className={`h-4 w-4 ${favorites.includes(exercise.id) ? "fill-chart-4 text-chart-4" : "text-muted-foreground"}`} />
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          ))
        )}
      </div>
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
}: {
  exercise: (typeof exercises)[0]
  onBack: () => void
  isFavorite: boolean
  onToggleFavorite: () => void
  lastDone: boolean
}) {
  const exerciseSteps = [
    { name: "Warm Up", duration: "3 min", reps: "Dynamic stretches" },
    { name: "Push Ups", duration: "45 sec", reps: "15 reps x 3 sets" },
    { name: "Squats", duration: "45 sec", reps: "20 reps x 3 sets" },
    { name: "Plank Hold", duration: "60 sec", reps: "3 sets" },
    { name: "Lunges", duration: "45 sec", reps: "12 each leg x 3" },
    { name: "Burpees", duration: "30 sec", reps: "10 reps x 3 sets" },
    { name: "Mountain Climbers", duration: "30 sec", reps: "20 reps x 3" },
    { name: "Cool Down", duration: "5 min", reps: "Stretching" },
  ]

  const handleStartWorkout = async () => {
    try {
      await addWorkout({
        title: exercise.title,
        category: exercise.category,
        duration: exercise.durationMin * 60,
        calories: exercise.calories,
        exerciseCount: exercise.exercises,
      })
      toast.success(`"${exercise.title}" completed!`)
      onBack()
    } catch (error) {
      toast.error("Failed to save workout")
      console.error(error)
    }
  }

  return (
    <div className="flex flex-col pb-28">
      <div className="relative h-64 overflow-hidden">
        <div className={`h-full w-full bg-gradient-to-br flex items-center justify-center ${categoryGradients[exercise.category]}`}>
          {(() => { const Icon = categoryIcons[exercise.category]; return <Icon className="h-20 w-20 text-white/40" /> })()}
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
            {lastDone && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/15 text-primary">Done before</span>}
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
          <p className="text-[10px] text-muted-foreground uppercase">Exercises</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border text-center">
          <span className="text-lg font-bold text-foreground">{exercise.duration}</span>
          <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
        </div>
        <div className="rounded-xl bg-card p-3 border border-border text-center">
          <span className="text-lg font-bold text-foreground">{exercise.calories}</span>
          <p className="text-[10px] text-muted-foreground uppercase">Calories</p>
        </div>
      </div>
      <div className="px-4 pt-5">
        <h2 className="text-sm font-semibold text-foreground mb-3">Workout Plan</h2>
        <div className="flex flex-col gap-2">
          {exerciseSteps.map((step, i) => (
            <div key={step.name} className="flex items-center gap-3 rounded-xl bg-card p-3 border border-border">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-muted-foreground">{i + 1}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{step.name}</p>
                <p className="text-xs text-muted-foreground">{step.reps}</p>
              </div>
              <span className="text-xs text-muted-foreground">{step.duration}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pt-5">
        <button onClick={handleStartWorkout} className="w-full rounded-xl bg-primary py-4 text-center font-semibold text-primary-foreground text-base transition-all hover:bg-primary/90 active:scale-[0.98]">
          Start Workout
        </button>
      </div>
    </div>
  )
}
