"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Activity,
  BarChart3,
  Droplets,
  Flame,
  Footprints,
  Heart,
  Moon,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react"
import type { TabId } from "./bottom-nav"
import { RingGauge } from "@/components/ring-gauge"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EASE, staggerDelaySec } from "@/lib/motion"
import type { TodayPrompt } from "@/lib/today-prompt"
import { CHROME } from "@/lib/app-chrome"
import { CreamCard } from "@/components/chrome/CreamCard"
import { SectionEyebrow } from "@/components/chrome/SectionEyebrow"
import { cn } from "@/lib/utils"

/** Home cockpit — uses shared CHROME tokens + chrome primitives. */
function AnimatedProgressBar({
  pct,
  color,
  delay = 0,
}: {
  pct: number
  color: string
  delay?: number
}) {
  const reduce = useReducedMotion() ?? false
  return (
    <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: "#eceae4" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={reduce ? { width: `${pct}%` } : { width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 0.85, ease: EASE.out, delay: 0.15 + delay }}
      />
    </div>
  )
}

function ActivityTile({
  label,
  value,
  unit,
  goalLabel,
  icon: Icon,
  iconBg,
  progress,
  delay,
}: {
  label: string
  value: string
  unit?: string
  goalLabel: string
  icon: typeof Flame
  iconBg: string
  progress: number
  delay: number
}) {
  return (
    <CreamCard delay={delay} className="flex min-h-[7.5rem] flex-col justify-between pb-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: CHROME.muted }}>
          {label}
        </p>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.5} aria-hidden />
        </span>
      </div>
      <div>
        <p className="text-[1.65rem] font-bold tabular-nums leading-none" style={{ color: CHROME.text }}>
          {value}
          {unit ? (
            <span className="ml-1 text-sm font-semibold" style={{ color: CHROME.muted }}>
              {unit}
            </span>
          ) : null}
        </p>
        <AnimatedProgressBar pct={progress} color={CHROME.orange} delay={delay} />
        <p className="mt-1.5 text-[10px] font-medium" style={{ color: CHROME.muted }}>
          {goalLabel}
        </p>
      </div>
    </CreamCard>
  )
}

const HR_ZONES = [
  { label: "Z1 Rest", color: "#64748b" },
  { label: "Z2 Fat", color: "#0d9488" },
  { label: "Z3 Cardio", color: CHROME.orange },
  { label: "Z4 Hard", color: "#ef4444" },
  { label: "Z5 Max", color: "#a855f7" },
] as const

const SLEEP_STAGES = [
  { key: "deep", label: "Deep", color: "#1e3a8a", ratio: 0.2 },
  { key: "light", label: "Light", color: "#60a5fa", ratio: 0.47 },
  { key: "rem", label: "REM", color: "#2dd4bf", ratio: 0.25 },
  { key: "awake", label: "Awake", color: "#fbbf24", ratio: 0.08 },
] as const

function formatSleep(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h} h ${m} m`
}

function formatStageMin(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export type HomeScreenProps = {
  loadError: string | null
  onRetry: () => void
  greeting: string
  displayName: string
  todayDateLine: string
  todayPrompt: TodayPrompt | null
  onPromptClick: () => void
  onNavigate: (tab: TabId) => void
  readinessScore: number
  readinessBand: string
  readinessHint: string
  hrvLabel: string
  rhrLabel: string
  sleepLabel: string
  moveRingCalories: number
  dailyCalorieGoal: number
  todayActiveMinutes: number
  dailyActiveMinGoal: number
  googleFitSteps: number | null
  hydrationMl: number
  hydrationGoalMl: number
  thisWeekTotal: number
  weekCompare: number
  weekly: { day: string; count: number; active: boolean }[]
  bestCoachScore: number
  streak: number
  avgPace: string | null
  heartBpm: number | null
  restingHr: number | null
  sleepTotalMin: number | null
  sleepGoalMin: number
  fourWeekTrend: { label: string; count: number }[]
  personalBests: {
    longestRunKm: number
    fastestPace: string | null
    bestCoachScore: number
    longestStreak: number
  }
  goals: string[]
  chartEnterAnim: boolean
}

export function HomeScreen(props: HomeScreenProps) {
  const reduce = useReducedMotion() ?? false
  const {
    loadError,
    onRetry,
    greeting,
    displayName,
    todayDateLine,
    todayPrompt,
    onPromptClick,
    onNavigate,
    readinessScore,
    readinessBand,
    readinessHint,
    hrvLabel,
    rhrLabel,
    sleepLabel,
    moveRingCalories,
    dailyCalorieGoal,
    todayActiveMinutes,
    dailyActiveMinGoal,
    googleFitSteps,
    hydrationMl,
    hydrationGoalMl,
    thisWeekTotal,
    weekCompare,
    weekly,
    bestCoachScore,
    streak,
    avgPace,
    heartBpm,
    restingHr,
    sleepTotalMin,
    sleepGoalMin,
    fourWeekTrend,
    personalBests,
    goals,
    chartEnterAnim,
  } = props

  const timeStr =
    typeof window !== "undefined"
      ? new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
      : ""

  const weekPeak = Math.max(1, ...weekly.map((w) => w.count))
  const dayOfWeek = new Date().getDay()
  const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const sleepMin = sleepTotalMin ?? 400
  const sleepGood = sleepMin >= sleepGoalMin * 0.75
  const sleepStages = SLEEP_STAGES.map((s) => ({
    ...s,
    minutes: Math.round(sleepMin * s.ratio),
  }))

  const nameLine = displayName === "there" ? "let's move." : `${displayName.charAt(0).toUpperCase()}${displayName.slice(1).toLowerCase()}.`

  return (
    <div className="relative -mx-4 -mt-4 pb-28" style={{ backgroundColor: CHROME.cream }}>
      {loadError ? (
        <div className="px-4 pt-3">
          <Alert variant="destructive" role="alert" className="border-destructive/40">
            <AlertTitle>Couldn&apos;t refresh home</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3 pt-1">
              <span className="flex-1 min-w-[12rem]">{loadError}</span>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {/* ── Dark header (screenshot 1) ── */}
      <header className="px-5 pb-5 pt-3" style={{ backgroundColor: CHROME.black }}>
        <div className="flex items-center justify-end">
          <span className="text-xs font-semibold tabular-nums text-white/80">{timeStr}</span>
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.24em] text-white/45">
          {todayDateLine.toUpperCase()}
        </p>
        <motion.h1
          className="mt-2 text-[1.85rem] font-bold leading-[1.15] tracking-[-0.02em] text-white"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          {greeting},{" "}
          <span style={{ color: CHROME.orange }}>{nameLine}</span>
        </motion.h1>

        {todayPrompt ? (
          <motion.button
            type="button"
            onClick={onPromptClick}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] px-4 py-3.5 text-left"
            style={{ backgroundColor: CHROME.focusBg }}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: CHROME.orange }}>
                Today&apos;s focus
              </p>
              <p className="mt-1 text-[15px] font-semibold text-white">{todayPrompt.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-white/45">{todayPrompt.hint}</p>
            </div>
            <motion.span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2"
              style={{ borderColor: CHROME.orange, backgroundColor: `${CHROME.orange}18` }}
              animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CHROME.orange }} />
            </motion.span>
          </motion.button>
        ) : null}
      </header>

      <div className="space-y-5 px-4 pt-5">
        {/* READINESS */}
        <section aria-label="Readiness">
          <SectionEyebrow>Readiness</SectionEyebrow>
          <CreamCard delay={0.04}>
            <div className="flex items-start justify-end">
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: CHROME.orange, backgroundColor: `${CHROME.orange}18` }}
              >
                {readinessBand}
              </span>
            </div>
            <div className="mt-1 flex items-start gap-4">
              <RingGauge
                value={readinessScore}
                max={100}
                size={108}
                thickness={9}
                spring
                trackClassName="stroke-[#eceae4]"
                progressClassName="stroke-[#f97316]"
              >
                <span className="text-[2rem] font-bold tabular-nums leading-none" style={{ color: CHROME.text }}>
                  <AnimatedCounter value={readinessScore} />
                </span>
              </RingGauge>
              <p className="min-w-0 flex-1 pt-2 text-[13px] leading-relaxed" style={{ color: "#525252" }}>
                {readinessHint}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold tabular-nums" style={{ color: CHROME.text }}>
              <span>HRV {hrvLabel}</span>
              <span>RHR {rhrLabel}</span>
              <span>Sleep {sleepLabel}</span>
            </div>
          </CreamCard>
        </section>

        {/* ACTIVITY · TODAY — 2×2 grid exactly like screenshot */}
        <section aria-label="Activity today">
          <SectionEyebrow>Activity · Today</SectionEyebrow>
          <div className="grid grid-cols-2 gap-2.5">
            <ActivityTile
              label="Calories"
              value={`${moveRingCalories}`}
              unit="kcal"
              goalLabel={`Goal ${dailyCalorieGoal}`}
              icon={Flame}
              iconBg={CHROME.orange}
              progress={(moveRingCalories / dailyCalorieGoal) * 100}
              delay={0.08}
            />
            <ActivityTile
              label="Active"
              value={`${todayActiveMinutes}`}
              unit="min"
              goalLabel={`Goal ${dailyActiveMinGoal}`}
              icon={Activity}
              iconBg="#3b82f6"
              progress={(todayActiveMinutes / dailyActiveMinGoal) * 100}
              delay={0.1}
            />
            <ActivityTile
              label="Steps"
              value={googleFitSteps != null ? googleFitSteps.toLocaleString() : "—"}
              goalLabel="Goal 8,000"
              icon={Footprints}
              iconBg="#22c55e"
              progress={googleFitSteps != null ? (googleFitSteps / 8000) * 100 : 0}
              delay={0.12}
            />
            <ActivityTile
              label="Hydration"
              value={`${hydrationMl}`}
              unit="ml"
              goalLabel={`0 · ${hydrationGoalMl}ml`}
              icon={Droplets}
              iconBg="#38bdf8"
              progress={(hydrationMl / hydrationGoalMl) * 100}
              delay={0.14}
            />
          </div>
        </section>

        {/* THIS WEEK — weekly activity card (screenshot 1 + 2) */}
        <section aria-label="This week">
          <SectionEyebrow>This Week</SectionEyebrow>
          <CreamCard delay={0.16}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" style={{ color: CHROME.teal }} aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CHROME.teal }}>
                  Weekly activity
                </span>
              </div>
              {weekCompare !== 0 ? (
                <motion.span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    color: weekCompare > 0 ? CHROME.gpsGreen : CHROME.muted,
                    backgroundColor: weekCompare > 0 ? `${CHROME.gpsGreen}18` : `${CHROME.muted}18`,
                  }}
                  initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 320, damping: 22 }}
                >
                  {weekCompare > 0 ? "+" : ""}{weekCompare}%
                </motion.span>
              ) : null}
            </div>
            <p className="mt-3 text-[1.35rem] font-bold leading-tight" style={{ color: CHROME.text }}>
              <AnimatedCounter value={thisWeekTotal} />{" "}
              <span className="text-base font-semibold">sessions this week</span>
            </p>
            <div className="mt-5 flex items-end justify-between gap-1.5" style={{ height: 72 }}>
              {weekly.map((w, i) => {
                const h = (w.count / weekPeak) * 100
                const isToday = i === (todayIdx >= 0 ? todayIdx : weekly.length - 1)
                return (
                  <div key={w.day} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        className="w-full rounded-t-md"
                        style={{
                          backgroundColor: w.count > 0 ? CHROME.orange : isToday ? CHROME.black : "#d4d4d4",
                          minHeight: w.count > 0 ? 8 : 6,
                        }}
                        initial={reduce ? false : { height: 0 }}
                        animate={{ height: `${Math.max(w.count > 0 ? 12 : 8, h)}%` }}
                        transition={{
                          duration: 0.55,
                          delay: 0.2 + staggerDelaySec(i, 7, 0.05),
                          ease: EASE.out,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold uppercase" style={{ color: CHROME.muted }}>
                      {w.day.charAt(0)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: CHROME.cardBorder }}>
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: CHROME.text }}>
                  {bestCoachScore > 0 ? bestCoachScore : "—"}
                </p>
                <p className="text-[10px] font-medium" style={{ color: CHROME.muted }}>
                  Form %
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: "#a855f7" }}>
                  {streak}
                </p>
                <p className="text-[10px] font-medium" style={{ color: CHROME.muted }}>
                  Streak days
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold tabular-nums" style={{ color: CHROME.text }}>
                  {avgPace ?? "—"}
                </p>
                <p className="text-[10px] font-medium" style={{ color: CHROME.muted }}>
                  Avg pace
                </p>
              </div>
            </div>
          </CreamCard>
        </section>

        {/* VITALS — heart rate (screenshot 2) */}
        <section aria-label="Vitals">
          <SectionEyebrow>Vitals</SectionEyebrow>
          <CreamCard delay={0.2}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" style={{ color: CHROME.hrRed }} aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CHROME.hrRed }}>
                  Heart rate
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: CHROME.orange, backgroundColor: `${CHROME.orange}15` }}
              >
                {heartBpm != null ? "Live" : "No live data"}
              </span>
            </div>
            <p className="mt-3 text-[1.65rem] font-bold tabular-nums leading-none" style={{ color: CHROME.text }}>
              {heartBpm ?? restingHr ?? "—"}{" "}
              <span className="text-sm font-semibold" style={{ color: CHROME.muted }}>
                bpm resting
              </span>
            </p>
            {(heartBpm != null || restingHr != null) ? (
            <div className="mt-4 flex gap-1">
              {HR_ZONES.map((z, i) => (
                <motion.div
                  key={z.label}
                  className="flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[8px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: z.color }}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                >
                  {z.label}
                </motion.div>
              ))}
            </div>
            ) : (
              <p className="mt-4 text-[11px]" style={{ color: CHROME.muted }}>
                Connect a wearable in Profile to see heart-rate zones.
              </p>
            )}
            <p className="mt-3 text-[11px]" style={{ color: CHROME.muted }}>
              Pair Bluetooth HR or sync Fitbit to see live zones
            </p>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="mt-2 text-[11px] font-semibold underline-offset-2 hover:underline"
              style={{ color: CHROME.orange }}
            >
              Open Profile → Sync
            </button>
          </CreamCard>
        </section>

        {/* SLEEP (screenshot 2 + 3) */}
        <CreamCard delay={0.24}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5" style={{ color: CHROME.teal }} aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CHROME.teal }}>
                Last night&apos;s sleep
              </span>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ color: CHROME.gpsGreen, backgroundColor: `${CHROME.gpsGreen}18` }}
            >
              {sleepGood ? "Good" : "Fair"}
            </span>
          </div>
          <p className="mt-3 text-[1.35rem] font-bold leading-tight" style={{ color: CHROME.text }}>
            {formatSleep(sleepMin)}{" "}
            <span className="text-sm font-semibold" style={{ color: CHROME.muted }}>
              of {Math.round(sleepGoalMin / 60)}h goal
            </span>
          </p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full">
            {sleepStages.map((s, i) => (
              <motion.div
                key={s.key}
                style={{ backgroundColor: s.color, width: `${s.ratio * 100}%` }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: EASE.out }}
                className="origin-left"
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {sleepStages.map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: CHROME.muted }}>
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                {s.label} {formatStageMin(s.minutes)}
              </span>
            ))}
          </div>
        </CreamCard>

        {/* 4-WEEK TREND (screenshot 3) */}
        {fourWeekTrend.length >= 2 ? (
          <section aria-label="Four week trend">
            <SectionEyebrow>4-Week Trend</SectionEyebrow>
            <CreamCard delay={0.28}>
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" style={{ color: CHROME.orange }} aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: CHROME.orange }}>
                  Sessions trend
                </span>
              </div>
              <MetricTrendMini
                className="mb-2 h-24 w-full"
                points={fourWeekTrend.map((w) => ({ v: w.count }))}
                stroke={CHROME.orange}
                stopColor={CHROME.orange}
                isAnimationActive={chartEnterAnim}
              />
              <div className="flex justify-between gap-2 px-1">
                {fourWeekTrend.map((w) => (
                  <div key={w.label} className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-[9px] font-bold uppercase" style={{ color: CHROME.muted }}>
                      {w.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: CHROME.text }}>
                      {w.count}
                    </span>
                  </div>
                ))}
              </div>
            </CreamCard>
          </section>
        ) : null}

        {/* PERSONAL BESTS (screenshot 3) */}
        <section aria-label="Personal bests">
          <SectionEyebrow>Personal Bests</SectionEyebrow>
          <CreamCard delay={0.32} className="pb-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Long run",
                  value: personalBests.longestRunKm > 0 ? personalBests.longestRunKm.toFixed(1) : "—",
                  unit: "km",
                },
                {
                  label: "Best pace",
                  value: personalBests.fastestPace ?? "—",
                  unit: "/km",
                },
                {
                  label: "Form score",
                  value: personalBests.bestCoachScore > 0 ? `${personalBests.bestCoachScore}%` : "—",
                  unit: "",
                },
                {
                  label: "Streak",
                  value: `${personalBests.longestStreak}`,
                  unit: "d",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  className="rounded-xl border px-3 py-3 text-center"
                  style={{ borderColor: CHROME.cardBorder, backgroundColor: "#fafaf8" }}
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.34 + i * 0.05 }}
                >
                  <p className="text-xl font-bold tabular-nums" style={{ color: CHROME.text }}>
                    {item.value}
                    {item.unit ? (
                      <span className="text-xs font-semibold" style={{ color: CHROME.muted }}>
                        {" "}
                        {item.unit}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[10px] font-medium" style={{ color: CHROME.muted }}>
                    {item.label}
                  </p>
                </motion.div>
              ))}
            </div>
            {goals.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <span
                    key={g}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{ color: CHROME.orange, backgroundColor: `${CHROME.orange}14`, border: `1px solid ${CHROME.orange}33` }}
                  >
                    <Target className="h-3 w-3" aria-hidden />
                    Goal: {g}
                  </span>
                ))}
              </div>
            ) : null}
          </CreamCard>
        </section>
      </div>
    </div>
  )
}
