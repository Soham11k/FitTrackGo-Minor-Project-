"use client"

/**
 * Dashboard color semantics: use `primary` / CSS vars for accent-driven progress UI;
 * keep `metric-streak` + amber for streak-specific affordances;
 * use `metric-coach` / `chart-2` for coach, `metric-run` for runs, `chart-4` for trophies/PBs.
 */

import { useState, useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  Activity,
  Flame,
  Timer,
  TrendingUp,
  Zap,
  Target,
  Trophy,
  ScanLine,
  Shield,
  RefreshCw,
} from "lucide-react"
import type { TabId } from "./bottom-nav"
import type { UserProfile, CoachRecord } from "@/lib/store"
import {
  getProfile,
  getWorkouts,
  getRuns,
  getCoachSessions,
  getStreak,
} from "@/lib/store-supabase"
import { WearableLiveHome } from "@/components/wearable-live-home"
import { RingGauge } from "@/components/ring-gauge"
import { HomeWeekChart } from "@/components/home-week-chart"
import { TodayStatQuad } from "@/components/today-stat-quad"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { DURATION, EASE, SPRING, staggerDelaySec } from "@/lib/motion"
import { useChartEnterOnce } from "@/hooks/use-chart-enter-once"
import { useLocale } from "@/components/locale-provider"

const quickActionDefs = [
  { icon: Zap, labelKey: "dashboard.goRun", tab: "run" as TabId, gradient: "from-primary/40 to-primary/5" },
  { icon: Target, labelKey: "dashboard.goForm", tab: "ai-coach" as TabId, gradient: "from-chart-2/35 to-chart-2/5" },
  { icon: Trophy, labelKey: "dashboard.goArena", tab: "arena" as TabId, gradient: "from-chart-4/35 to-chart-4/5" },
  { icon: Activity, labelKey: "dashboard.goMoves", tab: "exercises" as TabId, gradient: "from-chart-3/25 to-chart-3/5" },
] as const

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

const typeIcons = { workout: Activity, run: Activity, coach: Target, story: TrendingUp } as const

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.medium, ease: EASE.out } },
}

function toLocalDateStr(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function runDistanceKm(r: { distance?: number }): number {
  const n = Number(r.distance)
  return Number.isFinite(n) ? n : 0
}

function titleCaseFirstName(s: string) {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

export function Dashboard({
  isActive = true,
  onNavigate,
  onViewAll,
  onEnterCoachFocus,
}: {
  /** When false, vitals polling pauses; data still refetches when user returns to Home. */
  isActive?: boolean
  onNavigate: (tab: TabId) => void
  onViewAll?: () => void
  onEnterCoachFocus?: () => void
}) {
  const { t } = useLocale()
  const loadedOnce = useRef(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [latestCoach, setLatestCoach] = useState<CoachRecord | null>(null)
  const [stats, setStats] = useState({ totalCalories: 0, totalActiveMinutes: 0, streak: 0, totalWorkouts: 0, totalRuns: 0, totalDistance: 0 })
  const [weekly, setWeekly] = useState<{ day: string; count: number; active: boolean }[]>([])
  const [today, setToday] = useState({
    workouts: 0,
    runs: 0,
    coachSessions: 0,
    calories: 0,
    activeMinutes: 0,
    runDistanceTodayKm: 0,
  })
  const [recent, setRecent] = useState<{ type: string; title: string; detail: string; time: string }[]>([])
  const [lastWeekTotal, setLastWeekTotal] = useState(0)
  const [ringSheet, setRingSheet] = useState<null | "week" | "streak">(null)
  const [personalBests, setPersonalBests] = useState<{
    longestRunKm: number
    fastestPace: string | null
    bestCoachScore: number
    longestStreak: number
  }>({ longestRunKm: 0, fastestPace: null, bestCoachScore: 0, longestStreak: 0 })
  const [fourWeekTrend, setFourWeekTrend] = useState<{ label: string; count: number }[]>([])
  const chartEnterAnim = useChartEnterOnce()
  const reduceMotion = useReducedMotion() ?? false
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryBump, setRetryBump] = useState(0)

  useEffect(() => {
    if (!isActive) return

    async function load() {
      const initial = !loadedOnce.current
      try {
        setLoadError(null)
        if (initial) setLoading(true)
        const [p, workouts, runs, coachSessions, streak] = await Promise.all([
          getProfile(),
          getWorkouts(),
          getRuns(),
          getCoachSessions(),
          getStreak(),
        ])
        setProfile(p)
        setLatestCoach(coachSessions[0] ?? null)

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
        const todayMinutes = [...todayWorkouts, ...todayRuns].reduce((a, x) => a + Math.round((x.duration || 0) / 60), 0)
        setToday({
          workouts: todayWorkouts.length,
          runs: todayRuns.length,
          coachSessions: todayCoach.length,
          calories: [...todayWorkouts, ...todayRuns].reduce((a, x) => a + x.calories, 0),
          activeMinutes: todayMinutes + todayCoach.length * 3,
          runDistanceTodayKm: todayRuns.reduce((a, r) => a + runDistanceKm(r), 0),
        })

        const allRecent: { type: string; title: string; detail: string; time: string }[] = [
          ...workouts.map((w) => ({ type: "workout", title: w.title, detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)}min`, time: w.completedAt })),
          ...runs.map((r) => ({
            type: "run",
            title: "Run",
            detail: `${runDistanceKm(r).toFixed(2)} km · ${r.pace ?? "—"} pace`,
            time: r.completedAt,
          })),
          ...coachSessions.map((c) => ({
            type: "coach",
            title: `Coach: ${c.exercise}`,
            detail: `${c.reps} reps · ${c.score}%${c.effectiveReps != null ? ` · ${c.effectiveReps.toFixed(1)} eff` : ""}`,
            time: c.completedAt,
          })),
        ]
        const tr = runs.find((r) => toLocalDateStr(r.completedAt) === todayStr)
        const tc = coachSessions.find((c) => toLocalDateStr(c.completedAt) === todayStr)
        if (tr && tc) {
          allRecent.push({
            type: "story",
            title: "Run + Coach day",
            detail: `${runDistanceKm(tr).toFixed(2)} km · ${tc.exercise} ${tc.reps} reps`,
            time: new Date(tr.completedAt) > new Date(tc.completedAt) ? tr.completedAt : tc.completedAt,
          })
        }
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

        // 4-week trend (oldest → newest)
        const thisWeekStart = new Date(now)
        thisWeekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        thisWeekStart.setHours(0, 0, 0, 0)
        const all4 = [...workouts, ...runs, ...coachSessions]
        const trend: { label: string; count: number }[] = []
        for (let i = 3; i >= 0; i--) {
          const start = new Date(thisWeekStart)
          start.setDate(thisWeekStart.getDate() - i * 7)
          const end = new Date(start)
          end.setDate(start.getDate() + 7)
          const count = all4.filter((x) => {
            const d = new Date(x.completedAt)
            return d >= start && d < end
          }).length
          trend.push({ label: i === 0 ? "This" : `-${i}w`, count })
        }
        setFourWeekTrend(trend)

        // Personal bests
        const longestRunKm = runs.reduce((m, r) => Math.max(m, runDistanceKm(r)), 0)
        const paceToSec = (p?: string) => {
          if (!p) return Infinity
          const m = /^(\d+):(\d{1,2})$/.exec(p.trim())
          if (!m) return Infinity
          const s = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
          return s > 0 ? s : Infinity
        }
        const fastest = runs
          .filter((r) => runDistanceKm(r) >= 0.5)
          .reduce<{ pace: string | null; sec: number }>(
            (acc, r) => {
              const s = paceToSec(r.pace)
              return s < acc.sec ? { pace: r.pace, sec: s } : acc
            },
            { pace: null, sec: Infinity }
          )
        const bestCoachScore = coachSessions.reduce((m, c) => Math.max(m, c.score || 0), 0)
        setPersonalBests({
          longestRunKm,
          fastestPace: fastest.pace,
          bestCoachScore,
          longestStreak: streak || 0,
        })
        loadedOnce.current = true
      } catch (error) {
        console.error("Failed to load dashboard data:", error)
        setLoadError(error instanceof Error ? error.message : "Something went wrong loading your dashboard.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isActive, retryBump])

  const greeting = getGreeting()
  const name = profile?.name?.trim() || "there"
  const displayName = name === "there" ? name : name.split(" ")[0] ?? name

  const thisWeekTotal = weekly.reduce((a, w) => a + w.count, 0)
  const weekCompare = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : (thisWeekTotal > 0 ? 100 : 0)
  const weekTarget = Math.max(7, lastWeekTotal > 0 ? Math.ceil(lastWeekTotal * 1.15) : 7, thisWeekTotal, 1)
  const streakTarget = Math.max(14, stats.streak + 1)
  const dailySessionGoal = 1
  const dailyActiveMinGoal = 30
  const dailyCalorieGoal = 500
  const todaySessionTotal = today.workouts + today.runs + today.coachSessions
  const weekProgressPct = Math.min(100, (thisWeekTotal / Math.max(1, weekTarget)) * 100)
  const streakProgressPct = Math.min(100, (stats.streak / Math.max(1, streakTarget)) * 100)
  const todayDateLine = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })

  if (loading) {
    return (
      <div className="relative z-[1] flex flex-col gap-4 px-4 pt-3 pb-28">
        <div className="space-y-2" aria-busy="true" aria-label="Loading home">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-3 w-36 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-[1] flex flex-col gap-4 px-4 pt-3 pb-28">
      {loadError ? (
        <Alert variant="destructive" role="alert" className="border-destructive/40">
          <AlertTitle>Couldn&apos;t refresh home</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3 pt-1">
            <span className="flex-1 min-w-[12rem]">{loadError}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-destructive/40"
              onClick={() => setRetryBump((n) => n + 1)}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <header className="opacity-0 animate-fade-in-up animate-stagger-1">
        <p className="text-typo-caption font-medium text-primary">{greeting}</p>
        <h1
          className="mt-0.5 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {displayName === "there" ? (
            <>
              Start
              <span className="text-primary">.</span>
            </>
          ) : (
            <>
              {titleCaseFirstName(displayName)}
              <span className="text-primary">.</span>
            </>
          )}
        </h1>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground">{todayDateLine}</p>
      </header>

      <motion.section
        className="rounded-3xl border border-metric-coach/25 bg-gradient-to-br from-metric-coach/10 via-card to-card p-4 shadow-sm dark:border-white/10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        aria-label={t("dashboard.verifiedHeadline")}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-metric-coach/20">
            <Shield className="h-5 w-5 text-metric-coach" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {t("dashboard.verifiedHeadline")}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{t("dashboard.verifiedSub")}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate("ai-coach")}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
              >
                <ScanLine className="h-3.5 w-3.5" aria-hidden />
                {t("dashboard.verifiedCoachBtn")}
              </button>
              <button
                type="button"
                onClick={() => onNavigate("arena")}
                className="inline-flex items-center gap-1.5 rounded-full border border-metric-streak/40 bg-metric-streak/10 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-metric-streak/15"
              >
                <Trophy className="h-3.5 w-3.5 text-metric-streak" aria-hidden />
                {t("dashboard.verifiedArenaBtn")}
              </button>
            </div>
            {latestCoach && (
              <p className="text-typo-caption text-muted-foreground border-t border-border/60 pt-2 mt-1">
                <span className="font-semibold text-foreground">{t("dashboard.lastCoachTitle")}:</span>{" "}
                {latestCoach.exercise} · {latestCoach.reps} reps · {latestCoach.score}%
                {latestCoach.verifiedMovement ? " · verified" : ""}
                {latestCoach.faceVerifiedSession ? " · face match" : ""}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      <WearableLiveHome onNavigate={onNavigate} paused={!isActive} />

      <motion.section
        className="rounded-3xl border border-border/80 bg-card p-3 sm:p-4 dark:border-white/10"
        initial="hidden"
        animate="show"
        variants={fadeUp}
        aria-label="Today stats"
      >
        <h2 className="mb-3 text-xs font-semibold text-foreground">Today</h2>
        <TodayStatQuad
          sessions={todaySessionTotal}
          sessionGoal={dailySessionGoal}
          activeMinutes={today.activeMinutes}
          activeMinGoal={dailyActiveMinGoal}
          distanceKm={today.runDistanceTodayKm}
          calories={today.calories}
          calorieGoal={dailyCalorieGoal}
        />
      </motion.section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          onClick={() => setRingSheet("week")}
          className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.02, ease: [0.22, 1, 0.36, 1] }}
          aria-label="This week sessions, open details"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">This week</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {thisWeekTotal} <span className="text-sm font-medium text-muted-foreground">/ {weekTarget}</span>
              </p>
              <p className="text-typo-caption text-muted-foreground">Sessions</p>
            </div>
            <div className="shrink-0">
              <RingGauge value={thisWeekTotal} max={weekTarget} size={64} thickness={5} spring progressClassName="stroke-primary">
                <span className="text-sm font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                  {thisWeekTotal}
                </span>
              </RingGauge>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${weekProgressPct}%` }}
            />
          </div>
          {weekCompare !== 0 && (
            <p className={`text-xs font-medium tabular-nums ${weekCompare >= 0 ? "text-primary" : "text-muted-foreground"}`}>
              {weekCompare >= 0 ? "↑" : "↓"} {Math.abs(weekCompare)}% vs last week
            </p>
          )}
        </motion.button>
        <motion.button
          type="button"
          onClick={() => setRingSheet("streak")}
          className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Streak, open details"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Streak</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {stats.streak} <span className="text-sm font-medium text-muted-foreground">/ {streakTarget}</span>
              </p>
              <p className="text-typo-caption text-muted-foreground">Day streak</p>
            </div>
            <div className="shrink-0">
              <RingGauge value={stats.streak} max={streakTarget} size={64} thickness={5} spring progressClassName="stroke-amber-500">
                <span className="text-sm font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>{stats.streak}</span>
              </RingGauge>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500/90 transition-all duration-500"
              style={{ width: `${streakProgressPct}%` }}
            />
          </div>
        </motion.button>
      </div>

      <Sheet open={ringSheet != null} onOpenChange={(o) => !o && setRingSheet(null)}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl border-t border-border">
          {ringSheet === "week" ? (
            <>
              <SheetHeader className="border-b border-border/60 pb-3 text-left">
                <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Week at a glance</SheetTitle>
                <SheetDescription className="sr-only">
                  Sessions this calendar week: workouts, runs, and coach. Chart and totals below.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-8 pt-2">
                <div className="rounded-2xl border border-border/50 bg-muted/20 p-2 dark:border-white/10">
                  {isActive ? (
                    <HomeWeekChart weekly={weekly} isAnimationActive={false} />
                  ) : (
                    <div className="mx-auto h-[9.75rem] w-full rounded-xl bg-muted/30" aria-hidden />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/50 py-3 dark:border-white/10">
                    <span className="text-2xl font-bold tabular-nums text-primary" style={{ fontFamily: "var(--font-heading)" }}>
                      {thisWeekTotal}
                    </span>
                    <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">This week</span>
                  </div>
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/50 py-3 dark:border-white/10">
                    <span className="text-2xl font-bold tabular-nums text-muted-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {lastWeekTotal}
                    </span>
                    <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Last week</span>
                  </div>
                </div>
                {weekCompare !== 0 && (
                  <p className="text-center text-typo-caption font-medium text-muted-foreground">
                    <span className={weekCompare >= 0 ? "text-primary" : ""}>
                      {weekCompare >= 0 ? "↑" : "↓"} {Math.abs(weekCompare)}%
                    </span>{" "}
                    vs last week
                  </p>
                )}
              </div>
            </>
          ) : ringSheet === "streak" ? (
            <>
              <SheetHeader className="border-b border-border/60 pb-3 text-left">
                <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Streak</SheetTitle>
                <SheetDescription className="sr-only">
                  Consecutive active days and this week’s activity dots.
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-2">
                <div className="flex items-center justify-center gap-8 py-2">
                  <div className="flex flex-col items-center">
                    <RingGauge value={stats.streak} max={streakTarget} size={88} stroke={6} spring progressClassName="stroke-metric-streak">
                      <span className="text-xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        {stats.streak}
                      </span>
                      <span className="text-typo-micro font-bold uppercase text-muted-foreground">days</span>
                    </RingGauge>
                  </div>
                  <div className="text-center">
                    <p className="text-typo-eyebrow font-bold uppercase tracking-wider text-muted-foreground">Target</p>
                    <p className="text-2xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                      {streakTarget}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-center text-typo-micro font-bold uppercase tracking-[0.2em] text-muted-foreground">This week</p>
                  <div className="flex justify-between gap-1 px-1">
                    {weekly.map((item, i) => (
                      <motion.div
                        key={item.day}
                        className="flex flex-1 flex-col items-center gap-1.5"
                        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          ...SPRING.expressive,
                          delay: reduceMotion ? 0 : staggerDelaySec(i, 7, 0.04),
                        }}
                      >
                        <div
                          className={`h-3 w-3 rounded-full ${item.active ? "bg-primary shadow-[0_0_12px_var(--primary)] motion-safe:animate-[pulse_2.4s_ease-in-out_infinite]" : "bg-muted-foreground/20"}`}
                        />
                        <span className="text-typo-micro font-semibold text-muted-foreground">{item.day.slice(0, 1)}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <motion.div
        className="grid grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/80 bg-card py-4 shadow-sm dark:border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: "var(--font-heading)" }}>{stats.totalCalories}</span>
          <span className="text-typo-micro font-semibold uppercase tracking-[0.18em] text-muted-foreground">kcal</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/80 bg-card py-4 shadow-sm dark:border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Timer className="h-5 w-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: "var(--font-heading)" }}>{stats.totalActiveMinutes}</span>
          <span className="text-typo-micro font-semibold uppercase tracking-[0.18em] text-muted-foreground">min</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/80 bg-card py-4 shadow-sm dark:border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tabular-nums leading-none" style={{ fontFamily: "var(--font-heading)" }}>{stats.totalWorkouts + stats.totalRuns}</span>
          <span className="text-typo-micro font-semibold uppercase tracking-[0.18em] text-muted-foreground">log</span>
        </div>
      </motion.div>

      <motion.section
        className="rounded-3xl border border-border/80 bg-card p-3 shadow-sm dark:border-white/10"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-2 flex items-center justify-between px-0.5">
          <h2 className="text-xs font-semibold text-foreground">7-day</h2>
          {weekCompare !== 0 && (
            <span
              className={`shrink-0 text-xs font-semibold tabular-nums ${weekCompare >= 0 ? "text-primary" : "text-muted-foreground"}`}
            >
              {weekCompare >= 0 ? "↑" : "↓"}
              {Math.abs(weekCompare)}% vs last
            </span>
          )}
        </div>
        {isActive ? (
          <HomeWeekChart weekly={weekly} isAnimationActive={chartEnterAnim} />
        ) : (
          <div className="mx-auto h-[9.75rem] w-full rounded-xl bg-muted/25" aria-hidden />
        )}
      </motion.section>

      {fourWeekTrend.some((w) => w.count > 0) && (
        <motion.section
          className="rounded-3xl border border-border/80 bg-card p-3 shadow-sm dark:border-white/10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.125, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Four week trend"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">4-week trend</h2>
            <TrendingUp className="h-3.5 w-3.5 text-chart-2" aria-hidden />
          </div>
          {fourWeekTrend.length >= 2 && (
            <MetricTrendMini
              className="mb-2 h-24 w-full"
              points={fourWeekTrend.map((w) => ({ v: w.count }))}
              stroke="var(--primary)"
              stopColor="var(--primary)"
              isAnimationActive={chartEnterAnim}
            />
          )}
          <div className="flex items-end justify-between gap-2 px-1" style={{ height: 72 }}>
            {(() => {
              const peak = Math.max(1, ...fourWeekTrend.map((w) => w.count))
              return fourWeekTrend.map((w, i) => {
                const h = (w.count / peak) * 100
                const isCurrent = i === fourWeekTrend.length - 1
                return (
                  <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        initial={reduceMotion ? false : { height: 0 }}
                        animate={{ height: `${Math.max(6, h)}%` }}
                        transition={{
                          duration: reduceMotion ? 0.12 : 0.5,
                          delay: reduceMotion ? 0 : 0.1 + staggerDelaySec(i, 4, 0.06),
                          ease: EASE.out,
                        }}
                        className={`w-full rounded-md ${isCurrent ? "bg-primary" : "bg-primary/35"}`}
                      />
                    </div>
                    <span className="text-typo-micro font-bold uppercase tracking-wide text-muted-foreground">{w.label}</span>
                    <span className="text-typo-eyebrow font-bold tabular-nums text-foreground">{w.count}</span>
                  </div>
                )
              })
            })()}
          </div>
        </motion.section>
      )}

      {profile?.goals && profile.goals.length > 0 && (
        <motion.section
          className="rounded-3xl border border-border/80 bg-card/45 p-3 backdrop-blur-xl dark:border-white/10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.13, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Your goals"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">Your goals</h2>
            <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
          </div>
          <div className="flex flex-wrap gap-1.5 px-1">
            {profile.goals.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-typo-caption font-semibold text-primary"
              >
                <Target className="h-3 w-3" aria-hidden />
                {g}
              </span>
            ))}
          </div>
        </motion.section>
      )}

      {(personalBests.longestRunKm > 0 || personalBests.bestCoachScore > 0 || personalBests.longestStreak > 0 || personalBests.fastestPace) && (
        <motion.section
          className="rounded-3xl border border-border/80 bg-card/45 p-3 backdrop-blur-xl dark:border-white/10"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.13, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Personal bests"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">Personal bests</h2>
            <Trophy className="h-3.5 w-3.5 text-chart-4" aria-hidden />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-2 text-center dark:border-white/10">
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Long run</p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {personalBests.longestRunKm > 0 ? personalBests.longestRunKm.toFixed(1) : "—"}
              </p>
              <p className="text-typo-micro text-muted-foreground">km</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-2 text-center dark:border-white/10">
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Pace</p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {personalBests.fastestPace ?? "—"}
              </p>
              <p className="text-typo-micro text-muted-foreground">/km</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-2 text-center dark:border-white/10">
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Form</p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {personalBests.bestCoachScore > 0 ? personalBests.bestCoachScore : "—"}
              </p>
              <p className="text-typo-micro text-muted-foreground">%</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/40 p-2 text-center dark:border-white/10">
              <p className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Streak</p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {personalBests.longestStreak}
              </p>
              <p className="text-typo-micro text-muted-foreground">days</p>
            </div>
          </div>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2 className="mb-2 text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">Go</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActionDefs.map((action, i) => (
            <motion.button
              key={action.labelKey}
              type="button"
              onClick={() => onNavigate(action.tab)}
              className={`relative flex min-h-[100px] flex-col items-start justify-end overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br p-4 text-left transition-shadow duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10 ${action.gradient} shadow-lg shadow-black/10`}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING.list, delay: 0.16 + staggerDelaySec(i, 4, 0.06) }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.span
                className="absolute right-3 top-3 inline-flex"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              >
                <action.icon className="h-9 w-9 text-foreground/90 drop-shadow-sm" strokeWidth={1.75} />
              </motion.span>
              <span
                className="text-lg font-bold uppercase tracking-tight text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {t(action.labelKey)}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {onEnterCoachFocus ? (
        <motion.button
          type="button"
          onClick={() => onEnterCoachFocus()}
          className="flex w-full flex-col gap-1 rounded-3xl border border-metric-coach/35 bg-gradient-to-br from-metric-coach/15 to-chart-2/10 p-4 text-left shadow-sm transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-coach focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-metric-coach/25"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          aria-label="Open coach focus mode"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-metric-coach/20 text-metric-coach">
              <ScanLine className="h-6 w-6" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                Coach focus
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Form check only — hides the bottom nav until you exit
              </p>
            </div>
          </div>
        </motion.button>
      ) : null}

      <motion.section
        className="rounded-3xl border border-border/80 bg-card/45 p-4 backdrop-blur-xl dark:border-white/10"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">Feed</h2>
          <button
            type="button"
            onClick={onViewAll}
            className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-typo-eyebrow font-bold uppercase tracking-wider text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            All
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {recent.length === 0 ? (
            <Empty className="w-full rounded-2xl border border-dashed border-border/70 bg-muted/20 py-10 text-primary">
              <EmptyHeader>
                <EmptyMedia>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/illustrations/feed-empty.svg"
                    alt=""
                    className="h-[7.5rem] w-[7.5rem] opacity-90"
                  />
                </EmptyMedia>
                <EmptyTitle className="text-foreground">Your feed is warming up</EmptyTitle>
                <EmptyDescription>
                  Your first run or Coach session will show up here with distance, reps, and form highlights.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-none flex-row flex-wrap justify-center gap-2 pt-2">
                <Button type="button" className="rounded-full" onClick={() => onNavigate("run")}>
                  Start a run
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-primary/35 bg-background/80"
                  onClick={() => onNavigate("ai-coach")}
                >
                  Open Coach
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            recent.map((item, i) => {
              const Icon = typeIcons[item.type as keyof typeof typeIcons] ?? Activity
              const rel = (() => {
                const d = toLocalDateStr(item.time)
                const today = toLocalDateStr(new Date())
                const yesterday = toLocalDateStr(new Date(Date.now() - 86400000))
                if (d === today) return "Now"
                if (d === yesterday) return "1d"
                return `${Math.floor((Date.now() - new Date(item.time).getTime()) / 86400000)}d`
              })()
              return (
                <motion.div
                  key={`${item.type}-${item.time}`}
                  className="motion-card flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-r from-card/80 to-card/30 px-2 py-2.5 transition-colors hover:border-primary/20 dark:border-white/10"
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduceMotion ? 0 : staggerDelaySec(i, 8),
                    duration: DURATION.slow,
                    ease: EASE.out,
                  }}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/15">
                    <Icon className="h-7 w-7 text-primary" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">{item.title}</p>
                    <p className="truncate text-typo-eyebrow text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted/80 px-2 py-1 text-typo-micro font-bold tabular-nums text-muted-foreground">
                    {rel}
                  </span>
                </motion.div>
              )
            })
          )}
        </div>
      </motion.section>
    </div>
  )
}
