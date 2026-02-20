"use client"

import { useState, useEffect } from "react"
import { Activity, Flame, Timer, TrendingUp, ChevronRight, Zap, Target, Trophy } from "lucide-react"
import type { TabId } from "./bottom-nav"
import type { UserProfile } from "@/lib/store"
import {
  getProfile,
  getTotalStats,
  getWeeklyActivity,
  getTodaySummary,
  getRecentActivity,
  getWorkouts,
  getRuns,
  getCoachSessions,
} from "@/lib/store-supabase"

const quickActions = [
  { icon: Zap, label: "Quick Run", description: "Start a GPS run", tab: "run" as TabId, color: "bg-primary/15 text-primary" },
  { icon: Target, label: "AI Coach", description: "Form checker", tab: "ai-coach" as TabId, color: "bg-chart-2/15 text-chart-2" },
  { icon: Trophy, label: "Exercises", description: "Browse library", tab: "exercises" as TabId, color: "bg-chart-4/15 text-chart-4" },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

const typeIcons = { workout: Activity, run: Activity, coach: Target } as const

export function Dashboard({
  onNavigate,
  onViewAll,
}: {
  onNavigate: (tab: TabId) => void
  onViewAll?: () => void
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState({ totalCalories: 0, totalActiveMinutes: 0, streak: 0, totalWorkouts: 0, totalRuns: 0, totalDistance: 0 })
  const [weekly, setWeekly] = useState<{ day: string; count: number; active: boolean }[]>([])
  const [today, setToday] = useState({ workouts: 0, runs: 0, coachSessions: 0, calories: 0, activeMinutes: 0 })
  const [recent, setRecent] = useState<{ type: string; title: string; detail: string; time: string }[]>([])
  const [lastWeekTotal, setLastWeekTotal] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const [p, s, w, t, r] = await Promise.all([
          getProfile(),
          getTotalStats(),
          getWeeklyActivity(),
          getTodaySummary(),
          getRecentActivity(8),
        ])
        setProfile(p)
        setStats(s)
        setWeekly(w)
        setToday(t)
        setRecent(r)

        // Calculate last week total
        const workouts = await getWorkouts()
        const runs = await getRuns()
        const coachSessions = await getCoachSessions()
        const lastWeekStart = new Date()
        lastWeekStart.setDate(lastWeekStart.getDate() - ((lastWeekStart.getDay() + 6) % 7) - 7)
        lastWeekStart.setHours(0, 0, 0, 0)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 7)
        const all = [...workouts, ...runs, ...coachSessions]
        const count = all.filter((item) => {
          const date = new Date(item.completedAt)
          return date >= lastWeekStart && date < lastWeekEnd
        }).length
        setLastWeekTotal(count)
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
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
            <p className="text-[10px] text-muted-foreground uppercase">AI Coach</p>
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
            <div key={item.day} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative w-full flex justify-center">
                <div
                  className="w-6 rounded-full transition-all duration-500 min-h-[4px]"
                  style={{
                    height: `${Math.max(4, (item.count / maxWeek) * 100)}px`,
                    backgroundColor: item.active ? "var(--primary)" : "var(--secondary)",
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
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onNavigate(action.tab)}
              className="flex items-center gap-4 rounded-2xl bg-card p-4 border border-border text-left transition-all duration-200 hover:border-primary/30 hover:scale-[1.01] active:scale-[0.98]"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}>
                <action.icon className="h-6 w-6" />
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
      <section className="rounded-2xl bg-card p-5 border border-border transition-shadow hover:shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <button
            onClick={onViewAll}
            className="text-xs text-primary font-medium hover:underline"
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
            recent.map((item) => {
              const Icon = typeIcons[item.type as keyof typeof typeIcons] ?? Activity
              return (
                <div key={`${item.type}-${item.time}`} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {(() => {
                      const d = new Date(item.time).toISOString().split("T")[0]
                      const today = new Date().toISOString().split("T")[0]
                      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
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
