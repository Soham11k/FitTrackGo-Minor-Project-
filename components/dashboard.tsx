"use client"

/**
 * Dashboard color semantics: use `primary` / CSS vars for accent-driven progress UI;
 * keep `metric-streak` + amber for streak-specific affordances;
 * use `metric-coach` / `chart-2` for coach, `metric-run` for runs, `chart-4` for trophies/PBs.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
  Move,
} from "lucide-react"
import type { TabId } from "./bottom-nav"
import type { UserProfile, CoachRecord, RunRecord } from "@/lib/store"
import {
  getProfile,
  getWorkouts,
  getRuns,
  getCoachSessions,
  getStreak,
} from "@/lib/store-supabase"
import { WearableLiveHome, type WearableDashboardReadiness } from "@/components/wearable-live-home"
import { ProgramHub } from "@/components/program-hub"
import { ActivityDetailSheet, type ActivityDetailPayload } from "@/components/activity-detail"
import { TodayTripleRing } from "@/components/today-triple-ring"
import { RingGauge } from "@/components/ring-gauge"
import { HomeWeekChart } from "@/components/home-week-chart"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { InlineScreenSkeleton } from "@/components/brand/inline-screen-skeleton"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { DURATION, EASE, SPRING, staggerDelaySec, CINEMATIC } from "@/lib/motion"
import { useChartEnterOnce } from "@/hooks/use-chart-enter-once"
import { useLocale } from "@/components/locale-provider"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { resolveTodayPrompt } from "@/lib/today-prompt"
import { MetricGrid, MetricTile } from "@/components/brand/metric-panel"
import { ExerciseIllustration } from "@/components/animated/ExerciseIllustration"
import { cn } from "@/lib/utils"
import { DataScreen } from "@/components/brand/data-screen"

/**
 * NRC-style quick actions: the first (Run) is a hero black tile with a Volt CTA;
 * the rest are flush mono tiles with a hairline border. Volt overlay on the primary action.
 */
const quickActionDefs = [
  { icon: Zap, labelKey: "dashboard.goRun", tab: "run" as TabId, hero: true },
  { icon: Target, labelKey: "dashboard.goForm", tab: "ai-coach" as TabId, hero: false },
  { icon: Trophy, labelKey: "dashboard.goArena", tab: "arena" as TabId, hero: false },
  { icon: Activity, labelKey: "dashboard.goMoves", tab: "exercises" as TabId, hero: false },
] as const

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good Morning"
  if (h < 17) return "Good Afternoon"
  return "Good Evening"
}

const typeIcons = { workout: Activity, run: Activity, coach: Target, story: TrendingUp } as const

type DashboardFeedRow = {
  rowKey: string
  listType: keyof typeof typeIcons
  title: string
  detail: string
  time: string
  activity: ActivityDetailPayload
}

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
  onStartProgramCoach,
  onMobilityCoachIntent,
}: {
  /** When false, vitals polling pauses; data still refetches when user returns to Home. */
  isActive?: boolean
  onNavigate: (tab: TabId) => void
  onViewAll?: () => void
  onEnterCoachFocus?: () => void
  /** Program tab day → Coach with FormSpec preset */
  onStartProgramCoach?: (specId: string) => void
  /** Readiness cues → Mobility Coach strip */
  onMobilityCoachIntent?: () => void
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
  const [feedRows, setFeedRows] = useState<DashboardFeedRow[]>([])
  const [sessionsLast7d, setSessionsLast7d] = useState(0)
  const [mobilityWeekMinutes, setMobilityWeekMinutes] = useState(0)
  const [feedDetailActivity, setFeedDetailActivity] = useState<ActivityDetailPayload | null>(null)
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
  const [promptRuns, setPromptRuns] = useState<RunRecord[]>([])
  const [wearableHomeReadiness, setWearableHomeReadiness] = useState<WearableDashboardReadiness | null>(null)
  /** Google Fit daily aggregates (steps) → additive Move ring cue */
  const [googleFitSteps, setGoogleFitSteps] = useState<number | null>(null)
  const [wearableMoveCalBump, setWearableMoveCalBump] = useState(0)

  const onWearableHomeReadiness = useCallback((next: WearableDashboardReadiness | null) => {
    setWearableHomeReadiness(next)
  }, [])

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
        setPromptRuns(runs)

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

        const mobilitySecWeek = coachSessions
          .filter((c) => c.kind === "rom" && c.completedAt && new Date(c.completedAt).getTime() >= monday.getTime())
          .reduce((sum, c) => sum + (c.reps || 0), 0)
        setMobilityWeekMinutes(Math.round(mobilitySecWeek / 60))

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

        try {
          const hbRes = await fetch(
            `/api/wearables/home-boost?localToday=${encodeURIComponent(todayStr)}`,
            { credentials: "include" }
          )
          if (hbRes.ok) {
            const hb = (await hbRes.json()) as {
              googleFitSteps?: number | null
              moveCalBump?: number
            }
            const s = hb.googleFitSteps
            setGoogleFitSteps(typeof s === "number" && s > 0 ? Math.round(s) : null)
            setWearableMoveCalBump(Math.max(0, Math.round(Number(hb.moveCalBump) || 0)))
          } else {
            setGoogleFitSteps(null)
            setWearableMoveCalBump(0)
          }
        } catch {
          setGoogleFitSteps(null)
          setWearableMoveCalBump(0)
        }

        const allRecent: DashboardFeedRow[] = [
          ...workouts.map((w) => ({
            rowKey: `workout-${w.id}`,
            listType: "workout" as const,
            title: w.title,
            detail: `${w.exerciseCount} exercises · ${Math.round(w.duration / 60)}min`,
            time: w.completedAt,
            activity: { kind: "workout" as const, workout: w },
          })),
          ...runs.map((r) => ({
            rowKey: `run-${r.id}`,
            listType: "run" as const,
            title: "Run",
            detail: `${runDistanceKm(r).toFixed(2)} km · ${r.pace ?? "—"} pace`,
            time: r.completedAt,
            activity: { kind: "run" as const, run: r },
          })),
          ...coachSessions.map((c) => ({
            rowKey: `coach-${c.id}`,
            listType: "coach" as const,
            title: `Coach: ${c.exercise}`,
            detail: `${c.reps} reps · ${c.score}%${c.effectiveReps != null ? ` · ${c.effectiveReps.toFixed(1)} eff` : ""}`,
            time: c.completedAt,
            activity: { kind: "coach" as const, coach: c },
          })),
        ]
        const tr = runs.find((r) => toLocalDateStr(r.completedAt) === todayStr)
        const tc = coachSessions.find((c) => toLocalDateStr(c.completedAt) === todayStr)
        if (tr && tc) {
          allRecent.push({
            rowKey: `story-${tr.id}-${tc.id}`,
            listType: "story",
            title: "Run + Coach day",
            detail: `${runDistanceKm(tr).toFixed(2)} km · ${tc.exercise} ${tc.reps} reps`,
            time: new Date(tr.completedAt) > new Date(tc.completedAt) ? tr.completedAt : tc.completedAt,
            activity: { kind: "story" as const, run: tr, coach: tc },
          })
        }
        allRecent.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setFeedRows(allRecent.slice(0, 8))

        const weekAgoTs = Date.now() - 7 * 86400000
        const sessions7d = [...workouts, ...runs, ...coachSessions].filter(
          (x) => new Date(x.completedAt).getTime() >= weekAgoTs,
        ).length
        setSessionsLast7d(sessions7d)

        const lifetime = workouts.length + runs.length + coachSessions.length
        if (lifetime > 0 && typeof window !== "undefined") {
          try {
            localStorage.setItem("ft-bottom-nav-tutored", "1")
            window.dispatchEvent(new Event("ft-bottom-nav-tutored"))
          } catch {
            /* private mode */
          }
        }

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
        const msg = error instanceof Error ? error.message : "Something went wrong loading your dashboard."
        if (
          process.env.NODE_ENV === "development" &&
          (msg.includes("unreachable") || msg.includes("Not authenticated"))
        ) {
          setLoadError(null)
        } else {
          console.error("Failed to load dashboard data:", error)
          setLoadError(msg)
        }
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
  const moveRingCalories = Math.max(0, today.calories + wearableMoveCalBump)
  const googleFitMoveFootnote =
    googleFitSteps != null ? `${googleFitSteps.toLocaleString()} steps · Google Fit` : null
  const todaySessionTotal = today.workouts + today.runs + today.coachSessions
  const weekProgressPct = Math.min(100, (thisWeekTotal / Math.max(1, weekTarget)) * 100)
  const streakProgressPct = Math.min(100, (stats.streak / Math.max(1, streakTarget)) * 100)
  const todayDateLine = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })

  const todayPrompt = useMemo(
    () =>
      resolveTodayPrompt({
        runs: promptRuns,
        streakDays: stats.streak,
        coachSessionsThisWeekRomMinutes: mobilityWeekMinutes,
        wearableReadinessScore: wearableHomeReadiness?.score ?? null,
        wearableReadinessSignals: wearableHomeReadiness?.signalsOk ?? false,
      }),
    [
      mobilityWeekMinutes,
      promptRuns,
      stats.streak,
      wearableHomeReadiness?.score,
      wearableHomeReadiness?.signalsOk,
    ],
  )

  if (loading) {
    return (
      <div className="px-4 pt-3 pb-28">
        <InlineScreenSkeleton
          label="Loading home…"
          hint="Syncing today rings, weekly impact, and coaching highlights."
          layout="default"
          showLogo
        />
      </div>
    )
  }

  return (
    <DataScreen className="pt-3">
      <PwaInstallPrompt />
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
      <motion.header variants={CINEMATIC.heroEnter} initial="hidden" animate="show" className="-mx-1">
        <p className="text-typo-eyebrow font-bold uppercase tracking-[0.2em] text-muted-foreground">{todayDateLine}</p>
        <motion.h1
          className="mt-1 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl"
          style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          {greeting}, {displayName === "there" ? "let's move" : titleCaseFirstName(displayName)}
        </motion.h1>
        {todayPrompt ? (
          <button
            type="button"
            onClick={() => {
              if (todayPrompt.kind === "run" || todayPrompt.kind === "streak") onNavigate("run")
              else if (todayPrompt.kind === "mobility") {
                if (onMobilityCoachIntent) onMobilityCoachIntent()
                else onNavigate("ai-coach")
              } else {
                onNavigate("ai-coach")
              }
            }}
            className="press-magnetic nrc-card mt-4 w-full px-4 py-3 text-left transition-colors hover:bg-muted/30"
          >
            <p className="text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-primary">Today&apos;s focus</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{todayPrompt.title}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{todayPrompt.hint}</p>
          </button>
        ) : null}
      </motion.header>

      <motion.section
        aria-label="Today's metrics"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE.out }}
      >
        <MetricGrid cols={3} className="sm:grid-cols-3">
          <MetricTile
            label="Calories"
            value={`${moveRingCalories}`}
            numericValue={moveRingCalories}
            tone="move"
            icon={Flame}
            delta={`Goal ${dailyCalorieGoal}`}
            progress={Math.min(100, (moveRingCalories / dailyCalorieGoal) * 100)}
          />
          <MetricTile
            label="Active"
            value={`${today.activeMinutes}`}
            numericValue={today.activeMinutes}
            unit="m"
            tone="coach"
            icon={Activity}
            progress={Math.min(100, (today.activeMinutes / dailyActiveMinGoal) * 100)}
          />
          <MetricTile
            label="Steps"
            value={googleFitSteps != null ? googleFitSteps.toLocaleString() : "—"}
            numericValue={googleFitSteps ?? undefined}
            tone="steps"
            icon={TrendingUp}
            progress={googleFitSteps != null ? Math.min(100, (googleFitSteps / 8000) * 100) : 0}
          />
          <MetricTile
            label="Coach"
            value={latestCoach ? `${latestCoach.score}%` : "—"}
            numericValue={latestCoach ? latestCoach.score : undefined}
            tone="coach"
            icon={Shield}
            progress={latestCoach ? latestCoach.score : 0}
          />
          <MetricTile
            label="Streak"
            value={`${stats.streak}`}
            numericValue={stats.streak}
            unit="d"
            tone="streak"
            icon={Flame}
            progress={streakProgressPct}
          />
          <MetricTile
            label="This week"
            value={`${thisWeekTotal}`}
            numericValue={thisWeekTotal}
            tone="run"
            icon={Timer}
            delta={weekCompare !== 0 ? `${weekCompare >= 0 ? "↑" : "↓"} ${Math.abs(weekCompare)}%` : undefined}
            progress={weekProgressPct}
          />
        </MetricGrid>
      </motion.section>

      <motion.section
        className="nrc-card p-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.out }}
        aria-label="Today rings summary"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">Today</h2>
        <TodayTripleRing
          calories={moveRingCalories}
          calorieGoal={dailyCalorieGoal}
          activeMinutes={today.activeMinutes}
          activeMinGoal={dailyActiveMinGoal}
          sessions={todaySessionTotal}
          sessionGoal={dailySessionGoal}
          moveFootnote={googleFitMoveFootnote}
        />
      </motion.section>

      <WearableLiveHome
        sessionsLast7d={sessionsLast7d}
        onNavigate={onNavigate}
        paused={!isActive}
        onDashboardReadiness={isActive ? onWearableHomeReadiness : undefined}
      />

      {onStartProgramCoach ? (
        <motion.section
          className="nrc-card p-3 sm:p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: EASE.out }}
          aria-label="Training programs hub"
        >
          <ProgramHub onStartCoach={onStartProgramCoach} />
        </motion.section>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <motion.button
          type="button"
          onClick={() => setRingSheet("week")}
          className="press-magnetic nrc-card flex flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10"
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
          className="press-magnetic nrc-card flex flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-white/10"
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
        <motion.button
          type="button"
          onClick={() => onNavigate("ai-coach")}
          className="nrc-card col-span-1 flex flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:col-span-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          aria-label={t("dashboard.mobilityWeekTitle")}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-foreground">{t("dashboard.mobilityWeekTitle")}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                {mobilityWeekMinutes}{" "}
                <span className="text-sm font-medium text-muted-foreground">min</span>
              </p>
              <p className="text-typo-caption text-muted-foreground">{t("dashboard.mobilityWeekHint")}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-chart-3/20">
              <Move className="h-6 w-6 text-chart-3" strokeWidth={2} aria-hidden />
            </div>
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
        className="-mx-4 grid grid-cols-3 hairline-divide-x border-y border-border bg-background py-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Lifetime totals"
      >
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
          <Flame className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-3xl font-bold tabular-nums leading-none text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>{stats.totalCalories}</span>
          <span className="text-typo-micro font-bold uppercase tracking-[0.22em] text-muted-foreground">kcal</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
          <Timer className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-3xl font-bold tabular-nums leading-none text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>{stats.totalActiveMinutes}</span>
          <span className="text-typo-micro font-bold uppercase tracking-[0.22em] text-muted-foreground">min</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-3xl font-bold tabular-nums leading-none text-foreground" style={{ fontFamily: "var(--font-display), var(--font-heading)" }}>{stats.totalWorkouts + stats.totalRuns}</span>
          <span className="text-typo-micro font-bold uppercase tracking-[0.22em] text-muted-foreground">log</span>
        </div>
      </motion.div>

      <motion.section
        className="nrc-card p-3"
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
          className="nrc-card p-3"
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
          className="nrc-card p-3"
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
          className="nrc-card p-3"
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
        <h2 className="mb-3 text-typo-eyebrow font-bold uppercase tracking-[0.32em] text-muted-foreground">Go</h2>
        {/* Hero black tile (Run) + small mono tiles for the rest. */}
        <div className="space-y-2">
          {(() => {
            const hero = quickActionDefs[0]
            const HeroIcon = hero.icon
            return (
              <motion.button
                key={hero.labelKey}
                type="button"
                onClick={() => onNavigate(hero.tab)}
                className="relative flex min-h-[140px] w-full items-end overflow-hidden rounded-2xl border border-border bg-foreground text-background transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.list, delay: 0.16 }}
                whileTap={{ scale: 0.99 }}
              >
                {/* Animated runner silhouette in background */}
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-25">
                  <ExerciseIllustration id="run" size={100} animate color="var(--primary)" />
                </div>
                {/* Volt glow radial */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "radial-gradient(ellipse 50% 60% at 80% 50%, oklch(0.72 0.22 130 / 0.12) 0%, transparent 70%)" }}
                  aria-hidden
                />
                <div className="flex w-full items-end justify-between gap-2 p-4">
                  <div>
                    <p className="text-typo-eyebrow font-bold uppercase tracking-[0.32em] text-background/50">Start</p>
                    <span
                      className="block text-3xl font-bold uppercase leading-none tracking-tight text-background"
                      style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
                    >
                      {t(hero.labelKey)}
                    </span>
                  </div>
                  <motion.span
                    className="inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-2 text-typo-eyebrow font-bold uppercase tracking-[0.18em] text-primary-foreground shadow-[0_0_16px_oklch(0.72_0.22_130/0.5)]"
                    animate={{ boxShadow: [
                      "0 0 8px oklch(0.72 0.22 130 / 0.3)",
                      "0 0 20px oklch(0.72 0.22 130 / 0.6)",
                      "0 0 8px oklch(0.72 0.22 130 / 0.3)",
                    ]}}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Go
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                  </motion.span>
                </div>
              </motion.button>
            )
          })()}
          <div className="grid grid-cols-3 gap-2">
            {quickActionDefs.slice(1).map((action, i) => (
              <motion.button
                key={action.labelKey}
                type="button"
                onClick={() => onNavigate(action.tab)}
                className="relative flex min-h-[96px] flex-col items-start justify-between overflow-hidden rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.list, delay: 0.2 + staggerDelaySec(i, 3, 0.06) }}
                whileTap={{ scale: 0.98 }}
              >
                <action.icon className="h-6 w-6 text-foreground" strokeWidth={2} aria-hidden />
                <span
                  className="text-typo-eyebrow font-bold uppercase tracking-[0.16em] text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {t(action.labelKey)}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.section>

      {onEnterCoachFocus ? (
        <motion.button
          type="button"
          onClick={() => onEnterCoachFocus()}
          className="nrc-card flex w-full flex-col gap-1 border-metric-coach/25 p-4 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metric-coach focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        className="-mx-4 border-y border-border bg-background"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-typo-eyebrow font-bold uppercase tracking-[0.32em] text-muted-foreground">Feed</h2>
          <button
            type="button"
            onClick={onViewAll}
            className="text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            View All →
          </button>
        </div>
        <div className="flex flex-col">
          {feedRows.length === 0 ? (
            <Empty className="mx-4 w-auto border border-dashed border-border bg-background py-10 text-primary">
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
            feedRows.map((item, i) => {
              const Icon = typeIcons[item.listType] ?? Activity
              const rel = (() => {
                const d = toLocalDateStr(item.time)
                const today = toLocalDateStr(new Date())
                const yesterday = toLocalDateStr(new Date(Date.now() - 86400000))
                if (d === today) return "Now"
                if (d === yesterday) return "1d"
                return `${Math.floor((Date.now() - new Date(item.time).getTime()) / 86400000)}d`
              })()
              const isLatest = i === 0
              const isLast = i === feedRows.length - 1
              return (
                <motion.button
                  key={item.rowKey}
                  type="button"
                  onClick={() => setFeedDetailActivity(item.activity)}
                  className={cn(
                    "motion-card relative flex w-full items-center gap-3 border-t border-border bg-background px-4 py-3 text-left transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
                    isLast && "border-b",
                    isLatest && "volt-edge",
                  )}
                  initial={reduceMotion ? false : { opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduceMotion ? 0 : staggerDelaySec(i, 8),
                    duration: DURATION.slow,
                    ease: EASE.out,
                  }}
                >
                  <Icon className="h-5 w-5 shrink-0 text-foreground" strokeWidth={2} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-wide leading-tight text-foreground">{item.title}</p>
                    <p className="truncate text-typo-caption text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-typo-micro font-bold uppercase tracking-[0.22em] tabular-nums text-muted-foreground">
                    {rel}
                  </span>
                </motion.button>
              )
            })
          )}
        </div>
      </motion.section>

      <ActivityDetailSheet
        open={feedDetailActivity != null}
        onOpenChange={(o) => !o && setFeedDetailActivity(null)}
        activity={feedDetailActivity}
      />
    </DataScreen>
  )
}
