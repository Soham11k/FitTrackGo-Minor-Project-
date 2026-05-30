"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
import { InlineScreenSkeleton } from "@/components/brand/inline-screen-skeleton"
import { useChartEnterOnce } from "@/hooks/use-chart-enter-once"
import { PwaInstallPrompt } from "@/components/pwa-install-prompt"
import { resolveTodayPrompt } from "@/lib/today-prompt"
import { DataScreen } from "@/components/brand/data-screen"
import { HomeScreen } from "@/components/home-screen"

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
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

function localDateYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatSleepShort(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

export function Dashboard({
  isActive = true,
  onNavigate,
  onMobilityCoachIntent,
}: {
  isActive?: boolean
  onNavigate: (tab: TabId) => void
  onViewAll?: () => void
  onEnterCoachFocus?: () => void
  onStartProgramCoach?: (specId: string) => void
  onMobilityCoachIntent?: () => void
}) {
  const loadedOnce = useRef(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState({ streak: 0 })
  const [weekly, setWeekly] = useState<{ day: string; count: number; active: boolean }[]>([])
  const [today, setToday] = useState({ calories: 0, activeMinutes: 0 })
  const [sessionsLast7d, setSessionsLast7d] = useState(0)
  const [mobilityWeekMinutes, setMobilityWeekMinutes] = useState(0)
  const [lastWeekTotal, setLastWeekTotal] = useState(0)
  const [personalBests, setPersonalBests] = useState({
    longestRunKm: 0,
    fastestPace: null as string | null,
    bestCoachScore: 0,
    longestStreak: 0,
  })
  const [fourWeekTrend, setFourWeekTrend] = useState<{ label: string; count: number }[]>([])
  const [promptRuns, setPromptRuns] = useState<RunRecord[]>([])
  const chartEnterAnim = useChartEnterOnce()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryBump, setRetryBump] = useState(0)
  const [wearableHomeReadiness, setWearableHomeReadiness] = useState<WearableDashboardReadiness | null>(null)
  const [googleFitSteps, setGoogleFitSteps] = useState<number | null>(null)
  const [wearableMoveCalBump, setWearableMoveCalBump] = useState(0)
  const [allCoachSessions, setAllCoachSessions] = useState<CoachRecord[]>([])
  const [heartBpm, setHeartBpm] = useState<number | null>(null)
  const [restingHr, setRestingHr] = useState<number | null>(null)

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
        setPromptRuns(runs)
        setAllCoachSessions(coachSessions)
        setStats({ streak: streak || 0 })

        const now = new Date()
        const todayStr = toLocalDateStr(now)
        const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const monday = new Date(now)
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
        monday.setHours(0, 0, 0, 0)

        setWeekly(
          labels.map((day, i) => {
            const date = new Date(monday)
            date.setDate(monday.getDate() + i)
            const localDs = toLocalDateStr(date)
            const all = [...workouts, ...runs, ...coachSessions]
            const count = all.filter((r) => r.completedAt && toLocalDateStr(r.completedAt) === localDs).length
            return { day, count, active: count > 0 }
          }),
        )

        const mobilitySecWeek = coachSessions
          .filter((c) => c.kind === "rom" && c.completedAt && new Date(c.completedAt).getTime() >= monday.getTime())
          .reduce((sum, c) => sum + (c.reps || 0), 0)
        setMobilityWeekMinutes(Math.round(mobilitySecWeek / 60))

        const todayWorkouts = workouts.filter((w) => toLocalDateStr(w.completedAt) === todayStr)
        const todayRuns = runs.filter((r) => toLocalDateStr(r.completedAt) === todayStr)
        const todayCoach = coachSessions.filter((c) => toLocalDateStr(c.completedAt) === todayStr)
        const todayMinutes = [...todayWorkouts, ...todayRuns].reduce((a, x) => a + Math.round((x.duration || 0) / 60), 0)
        setToday({
          calories: [...todayWorkouts, ...todayRuns].reduce((a, x) => a + x.calories, 0),
          activeMinutes: todayMinutes + todayCoach.length * 3,
        })

        try {
          const hbRes = await fetch(`/api/wearables/home-boost?localToday=${encodeURIComponent(todayStr)}`, {
            credentials: "include",
          })
          if (hbRes.ok) {
            const hb = (await hbRes.json()) as { googleFitSteps?: number | null; moveCalBump?: number }
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

        const weekAgoTs = Date.now() - 7 * 86400000
        setSessionsLast7d(
          [...workouts, ...runs, ...coachSessions].filter((x) => new Date(x.completedAt).getTime() >= weekAgoTs).length,
        )

        const lastWeekStart = new Date()
        lastWeekStart.setDate(lastWeekStart.getDate() - ((lastWeekStart.getDay() + 6) % 7) - 7)
        lastWeekStart.setHours(0, 0, 0, 0)
        const lastWeekEnd = new Date(lastWeekStart)
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 7)
        setLastWeekTotal(
          [...workouts, ...runs, ...coachSessions].filter((item) => {
            const date = new Date(item.completedAt)
            return date >= lastWeekStart && date < lastWeekEnd
          }).length,
        )

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
          trend.push({ label: i === 0 ? "This W" : `-${i}W`, count })
        }
        setFourWeekTrend(trend)

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
            { pace: null, sec: Infinity },
          )

        setPersonalBests({
          longestRunKm: runs.reduce((m, r) => Math.max(m, runDistanceKm(r)), 0),
          fastestPace: fastest.pace,
          bestCoachScore: coachSessions.reduce((m, c) => Math.max(m, c.score || 0), 0),
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

  // Live vitals for the heart-rate card
  useEffect(() => {
    if (!isActive) return
    let cancelled = false

    void fetch(`/api/wearables/live?date=${encodeURIComponent(localDateYmd())}`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { heartBpm?: number | null; connected?: boolean }
        if (!cancelled && r.ok) setHeartBpm(typeof j.heartBpm === "number" ? j.heartBpm : null)
      })
      .catch(() => {
        if (!cancelled) setHeartBpm(null)
      })

    void fetch(`/api/wearables/history?limit=14`, { credentials: "include" })
      .then(async (r) => {
        const j = (await r.json()) as { rows?: Array<{ resting_heart_rate?: number | null }> }
        if (!cancelled && r.ok) {
          const row = Array.isArray(j.rows) ? j.rows.find((x) => x.resting_heart_rate != null) : undefined
          setRestingHr(row?.resting_heart_rate != null ? Number(row.resting_heart_rate) : null)
        }
      })
      .catch(() => {
        if (!cancelled) setRestingHr(null)
      })

    return () => {
      cancelled = true
    }
  }, [isActive, retryBump])

  const greeting = getGreeting()
  const name = profile?.name?.trim() || "there"
  const displayName = name === "there" ? name : (name.split(" ")[0] ?? name)
  const thisWeekTotal = weekly.reduce((a, w) => a + w.count, 0)
  const weekCompare =
    lastWeekTotal > 0
      ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100)
      : thisWeekTotal > 0
        ? 100
        : 0
  const dailyActiveMinGoal = 30
  const dailyCalorieGoal = 500
  const moveRingCalories = Math.max(0, today.calories + wearableMoveCalBump)
  const todayDateLine = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const readinessScore = useMemo(() => {
    if (typeof wearableHomeReadiness?.score === "number") return wearableHomeReadiness.score
    const base = 67
    const volPenalty = Math.min(18, Math.max(0, sessionsLast7d - 4) * 3)
    const streakBonus = Math.min(6, stats.streak)
    return Math.max(38, Math.min(96, Math.round(base - volPenalty + streakBonus)))
  }, [wearableHomeReadiness?.score, sessionsLast7d, stats.streak])

  const readinessBand = readinessScore >= 80 ? "Optimal" : readinessScore >= 60 ? "Moderate" : "Low"
  const readinessHint =
    readinessScore >= 80
      ? "Primed to perform — green light for a harder session today."
      : readinessScore >= 60
        ? "High weekly volume — prioritize sleep and easy movement today."
        : "Recovery first — light mobility or rest beats a hard push now."

  const todayPrompt = useMemo(
    () =>
      resolveTodayPrompt({
        runs: promptRuns,
        streakDays: stats.streak,
        coachSessionsThisWeekRomMinutes: mobilityWeekMinutes,
        wearableReadinessScore: wearableHomeReadiness?.score ?? null,
        wearableReadinessSignals: wearableHomeReadiness?.signalsOk ?? false,
      }),
    [mobilityWeekMinutes, promptRuns, stats.streak, wearableHomeReadiness?.score, wearableHomeReadiness?.signalsOk],
  )

  const bestCoachScore = allCoachSessions.reduce((m, c) => Math.max(m, c.score || 0), 0)
  const effectiveSleepMin = 400

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
    <DataScreen className="gap-0 p-0 pt-0">
      <PwaInstallPrompt />
      {/* Hidden — keeps readiness polling + callback alive */}
      <div className="sr-only" aria-hidden>
        <WearableLiveHome
          sessionsLast7d={sessionsLast7d}
          onNavigate={onNavigate}
          paused={!isActive}
          onDashboardReadiness={isActive ? onWearableHomeReadiness : undefined}
        />
      </div>

      <HomeScreen
        loadError={loadError}
        onRetry={() => setRetryBump((n) => n + 1)}
        greeting={greeting}
        displayName={displayName}
        todayDateLine={todayDateLine}
        todayPrompt={todayPrompt}
        onPromptClick={() => {
          if (!todayPrompt) return
          if (todayPrompt.kind === "run" || todayPrompt.kind === "streak") onNavigate("run")
          else if (todayPrompt.kind === "mobility") {
            if (onMobilityCoachIntent) onMobilityCoachIntent()
            else onNavigate("ai-coach")
          } else {
            onNavigate("ai-coach")
          }
        }}
        onNavigate={onNavigate}
        readinessScore={readinessScore}
        readinessBand={readinessBand}
        readinessHint={readinessHint}
        hrvLabel="—"
        rhrLabel={restingHr != null ? `${restingHr} bpm` : "—"}
        sleepLabel={formatSleepShort(effectiveSleepMin)}
        moveRingCalories={moveRingCalories}
        dailyCalorieGoal={dailyCalorieGoal}
        todayActiveMinutes={today.activeMinutes}
        dailyActiveMinGoal={dailyActiveMinGoal}
        googleFitSteps={googleFitSteps}
        hydrationMl={0}
        hydrationGoalMl={2000}
        thisWeekTotal={thisWeekTotal}
        weekCompare={weekCompare}
        weekly={weekly}
        bestCoachScore={bestCoachScore}
        streak={stats.streak}
        avgPace={personalBests.fastestPace}
        heartBpm={heartBpm}
        restingHr={restingHr}
        sleepTotalMin={effectiveSleepMin}
        sleepGoalMin={480}
        fourWeekTrend={fourWeekTrend}
        personalBests={personalBests}
        goals={profile?.goals ?? []}
        chartEnterAnim={chartEnterAnim}
      />
    </DataScreen>
  )
}
