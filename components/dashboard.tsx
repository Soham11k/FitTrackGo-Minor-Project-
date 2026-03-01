"use client"

import { useState, useEffect } from "react"
import { Activity, Flame, Timer, TrendingUp, ChevronRight, Zap, Target, Trophy } from "lucide-react"
import type { TabId } from "./bottom-nav"
import type { UserProfile } from "@/lib/store"
import {
  getProfile,
  getWorkouts,
  getRuns,
  getCoachSessions,
  getStreak,
} from "@/lib/store-supabase"

const quickActions = [
  { icon: Zap, label: "Quick Run", description: "Start a GPS run", tab: "run" as TabId, color: "bg-primary/15 text-primary" },
  { icon: Target, label: "Coach Assist", description: "Form checker", tab: "ai-coach" as TabId, color: "bg-chart-2/15 text-chart-2" },
  { icon: Trophy, label: "Exercises", description: "Browse library", tab: "exercises" as TabId, color: "bg-chart-4/15 text-chart-4" },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

const typeIcons = { workout: Activity, run: Activity, coach: Target } as const

function toLocalDateStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function Dashboard({
  onNavigate,
  onViewAll,
}: {
  onNavigate: (tab: TabId) => void
  onViewAll?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState({ totalCalories: 0, totalActiveMinutes: 0, streak: 0, totalWorkouts: 0, totalRuns: 0, totalDistance: 0 })
  const [weekly, setWeekly] = useState<{ day: string; count: number; active: boolean }[]>([])
  const [today, setToday] = useState({ workouts: 0, runs: 0, coachSessions: 0, calories: 0, activeMinutes: 0 })
  const [recent, setRecent] = useState<{ type: string; title: string; detail: string; time: string }[]>([])
  const [lastWeekTotal, setLastWeekTotal] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [p, workouts, runs, coachSessions, streak] = await Promise.all([
          getProfile(),
          getWorkouts(),
          getRuns(),
          getCoachSessions(),
          getStreak(),
        ])
        setProfile(p)

        const totalCalories = [...workouts.map((w) => w.calories || 0), ...runs.map((r) => r.calories || 0)].reduce((a, b) => a + b, 0)
        const totalActiveMinutes = workouts.reduce((a, w) => a + Math.round((w.duration || 0) / 60), 0) + runs.reduce((a, r) => a + Math.round((r.duration || 0) / 60), 0)
        setStats({
          totalCalories,
          totalActiveMinutes,
          streak: streak || 0,
          totalWorkouts: workouts.length + coachSessions.length,
          totalRuns: runs.length,
          totalDistance: runs.reduce((a, r) => a + (r.distance || 0), 0),
        })

        // Use local date so "today" and week bars match the user's calendar (fixes timezone bug)
        const now = new Date()
        const todayStr = toLocalDateStr(now)

        const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        monday.setHours(0, 0, 0, 0)
        const weeklyData = labels.map((day, i) => {
          const date = new Date(monday)
          date.setDate(monday.getDate() + i)
          const localDs = toLocalDateStr(date)
          const all = [...workouts, ...runs, ...coachSessions]
          const count = all.filter((r) => r.completedAt && toLocalDateStr(r.completedAt) === localDs).length
          return { day, count, active: count > 0 }
        })
        setWeekly(weeklyData)

        const todayWorkouts = workouts.filter((w) => toLocalDateStr(w.completedAt) === todayStr)
        const todayRuns = runs.filter((r) => toLocalDateStr(r.completedAt) === todayStr)
        const todayCoach = coachSessions.filter((c) => toLocalDateStr(c.completedAt) === todayStr)
        setToday({
          workouts: todayWorkouts.length,
          runs: todayRuns.length,
          coachSessions: todayCoach.length,
          calories: [...todayWorkouts, ...todayRuns].reduce((a, x) => a + x.calories, 0),
          activeMinutes: [...todayWorkouts, ...todayRuns, ...todayCoach].reduce((a, x) => a + Math.round(x.duration / 60), 0) + todayCoach.length * 3,
        })

        const allRecent: { type: string; title: string; detail: string; time: string }[] = [
          ...workouts.map((w) => ({ type: "workout", title: w.title, detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)}min`, time: w.completedAt })),
          ...runs.map((r) => ({ type: "run", title: "Run", detail: `${r.distance.toFixed(2)} km · ${r.pace} pace`, time: r.completedAt })),
          ...coachSessions.map((c) => ({ type: "coach", title: `Coach: ${c.exercise}`, detail: `${c.reps} reps · ${c.score}%`, time: c.completedAt })),
        ]
        allRecent.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setRecent(allRecent.slice(0, 8))

        const lastWeekStart = new Date()
        lastWeekStart.setDate(lastWeekStart.getDate() - ((lastWeekStart.getDay() + 6) % 7) - 7)
        lastWeekStart.setHours(0, 0, 0, 0)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 7)
        const lastWeekCount = [...workouts, ...runs, ...coachSessions].filter((item) => {
          const date = new Date(item.completedAt)
          return date >= lastWeekStart && date < lastWeekEnd
        }).length
        setLastWeekTotal(lastWeekCount)
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const greeting = getGreeting()
  const name = profile?.name?.trim() || "there"
  const displayName = name === "there" ? name : name.split(" ")[0] ?? name

  const maxWeek = Math.max(1, ...weekly.map((w) => w.count))
  const thisWeekTotal = weekly.reduce((a, w) => a + w.count, 0)
  const weekCompare = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : (thisWeekTotal > 0 ? 100 : 0)

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-4 pb-28">
        <header className="animate-pulse">
          <div className="h-4 w-32 rounded bg-muted mb-2" />
          <div className="h-8 w-56 rounded bg-muted" />
        </header>
        <section className="rounded-2xl bg-card p-4 border border-border">
          <div className="h-4 w-14 rounded bg-muted mb-3" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-6 w-8 rounded bg-muted" />
                <div className="h-3 w-14 rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-card p-4 border border-border flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="h-6 w-12 rounded bg-muted" />
              <div className="h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <section className="rounded-2xl bg-card p-5 border border-border">
          <div className="h-4 w-20 rounded bg-muted mb-4" />
          <div className="flex justify-between gap-2 h-28">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-6 h-16 rounded bg-muted" />
                <div className="h-3 w-6 rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>
        <section>
          <div className="h-4 w-24 rounded bg-muted mb-3" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-2xl bg-card p-4 border border-border">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-card p-5 border border-border">
          <div className="h-4 w-28 rounded bg-muted mb-4" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-36 rounded bg-muted" />
                </div>
                <div className="h-3 w-10 rounded bg-muted" />
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-28">
      <header className="opacity-0 animate-fade-in-up animate-stagger-1">
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
          {displayName === "there" ? "Ready to crush it?" : `${displayName}, ready to crush it?`}
        </h1>
      </header>

      {/* Today summary */}
      <section className="rounded-2xl bg-card p-4 border border-border opacity-0 animate-fade-in-up animate-stagger-2 transition-shadow hover:shadow-md">
        <h2 className="text-sm font-semibold text-foreground mb-3">Today</h2>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <span className="text-lg font-bold text-foreground">{today.workouts}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Workouts</p>
          </div>
          <div>
            <span className="text-lg font-bold text-foreground">{today.runs}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Runs</p>
          </div>
          <div>
            <span className="text-lg font-bold text-foreground">{today.coachSessions}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Coach Assist</p>
          </div>
          <div>
            <span className="text-lg font-bold text-primary">{today.calories}</span>
            <p className="text-[10px] text-muted-foreground uppercase">Cal</p>
          </div>
        </div>
        {today.activeMinutes > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            ~{today.activeMinutes} min active today
          </p>
        )}
      </section>

      {/* Stats row - tappable context via title */}
      <div className="grid grid-cols-3 gap-3 opacity-0 animate-fade-in-up animate-stagger-3">
        <div
          className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 border border-border transition-transform hover:scale-[1.02]"
          title="Total calories from all activities"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold text-foreground">{stats.totalCalories}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Calories</span>
        </div>
        <div
          className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 border border-border"
          title="Total active minutes (workouts + runs)"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/15">
            <Timer className="h-5 w-5 text-chart-2" />
          </div>
          <span className="text-xl font-bold text-foreground">{stats.totalActiveMinutes}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Active min</span>
        </div>
        <div
          className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 border border-border"
          title="Current streak (consecutive days with activity)"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-4/15">
            <TrendingUp className="h-5 w-5 text-chart-4" />
          </div>
          <span className="text-xl font-bold text-foreground">{stats.streak}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Day streak</span>
        </div>
      </div>

      {/* Weekly activity */}
      <section className="rounded-2xl bg-card p-5 border border-border opacity-0 animate-fade-in-up animate-stagger-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">This Week</h2>
          {weekCompare !== 0 && (
            <span className={`text-xs font-medium ${weekCompare >= 0 ? "text-primary" : "text-muted-foreground"}`}>
              {weekCompare >= 0 ? "+" : ""}{weekCompare}% vs last week
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2 h-28">
          {weekly.map((item, i) => (
            <div key={item.day} className="flex flex-1 flex-col items-center gap-1 opacity-0 animate-fade-in-up" style={{ animationDelay: `${0.2 + i * 0.06}s`, animationFillMode: "forwards" }}>
              <div className="relative w-full flex justify-center">
                <div
                  className="w-6 rounded-full transition-all duration-500 min-h-[4px] origin-bottom animate-bar-grow"
                  style={{
                    height: `${Math.max(4, (item.count / maxWeek) * 100)}px`,
                    backgroundColor: item.active ? "var(--primary)" : "var(--secondary)",
                    animationDelay: `${0.3 + i * 0.05}s`,
                    animationFillMode: "forwards",
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{item.day}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Start */}
      <section className="opacity-0 animate-fade-in-up animate-stagger-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Start</h2>
        <div className="flex flex-col gap-3">
          {quickActions.map((action, i) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.tab)}
              className="flex min-h-[44px] items-center gap-4 rounded-2xl bg-card p-4 border border-border text-left transition-all duration-300 hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background opacity-0 animate-slide-in-left"
              style={{ animationDelay: `${0.2 + i * 0.08}s`, animationFillMode: "forwards" }}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color} transition-transform duration-300 hover:scale-110`}>
                <action.icon className="h-6 w-6 animate-float" style={{ animationDelay: `${i * 0.2}s` }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{action.label}</h3>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section className="rounded-2xl bg-card p-5 border border-border transition-all duration-300 hover:shadow-lg opacity-0 animate-fade-in-up animate-stagger-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <button
            onClick={onViewAll}
            className="text-xs text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:rounded"
          >
            View All
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No activity yet. Start a run or workout to see it here.
            </p>
          ) : (
            recent.map((item, i) => {
              const Icon = typeIcons[item.type as keyof typeof typeIcons] ?? Activity
              return (
                <div key={`${item.type}-${item.time}`} className="flex items-center gap-3 opacity-0 animate-fade-in-up transition-transform duration-200 hover:translate-x-0.5" style={{ animationDelay: `${0.4 + i * 0.05}s`, animationFillMode: "forwards" }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {(() => {
                      const d = toLocalDateStr(item.time)
                      const today = toLocalDateStr(new Date())
                      const yesterday = toLocalDateStr(new Date(Date.now() - 86400000))
                      if (d === today) return "Today"
                      if (d === yesterday) return "Yesterday"
                      return `${Math.floor((Date.now() - new Date(item.time).getTime()) / 86400000)}d ago`
                    })()}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
