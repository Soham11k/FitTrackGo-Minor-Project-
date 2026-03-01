"use client"

import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronLeft, Flame, MapPin, Target, Dumbbell } from "lucide-react"
import { getWorkouts, getRuns, getCoachSessions } from "@/lib/store-supabase"

export function WorkoutHistory({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Array<{ type: string; id: string; title: string; detail: string; time: string; icon: typeof Dumbbell }>>([])

  useEffect(() => {
    async function load() {
      try {
        const [workouts, runs, coach] = await Promise.all([
          getWorkouts(),
          getRuns(),
          getCoachSessions(),
        ])

        const workoutItems = workouts.map((w) => ({
          type: "workout" as const,
          id: w.id,
          title: w.title,
          detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)} min · ${w.calories} cal`,
          time: w.completedAt,
          icon: Dumbbell,
        }))
        const runItems = runs.map((r) => ({
          type: "run" as const,
          id: r.id,
          title: "Run",
          detail: `${r.distance.toFixed(2)} km · ${r.pace}/km · ${Math.round(r.calories)} cal`,
          time: r.completedAt,
          icon: MapPin,
        }))
        const coachItems = coach.map((c) => ({
          type: "coach" as const,
          id: c.id,
          title: `AI: ${c.exercise}`,
          detail: `${c.reps} reps · ${c.score}% form`,
          time: c.completedAt,
          icon: Target,
        }))
        const all = [...workoutItems, ...runItems, ...coachItems].sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        )
        setItems(all)
      } catch (error) {
        console.error("Failed to load history:", error)
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col pb-28">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border text-foreground"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          Activity History
        </h1>
      </div>
      <div className="px-4 py-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <Flame className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground mt-1">Runs, workouts, and Coach Assist sessions will appear here.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 border border-border"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
