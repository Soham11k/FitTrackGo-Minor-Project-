"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  ChevronRight,
  Droplets,
  Flame,
  Footprints,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { TabId } from "./bottom-nav"
import { RingGauge } from "@/components/ring-gauge"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EASE, staggerDelaySec } from "@/lib/motion"
import type { TodayPrompt } from "@/lib/today-prompt"
import { CHROME } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"
import { DarkCard } from "@/components/chrome/DarkCard"
import { EcgMark } from "@/components/chrome/EcgMark"

function recoveryTitle(score: number): string {
  if (score >= 80) return "PRIMED TO PERFORM"
  if (score >= 60) return "MODERATE LOAD"
  return "RECOVERY FIRST"
}

const HOME = {
  accent: CHROME_ACCENT.accent,
  accentDim: CHROME_ACCENT.accentDim,
  accentBorder: CHROME_ACCENT.accentBorder,
  black: CHROME.homeBlack,
  card: CHROME.homeCard,
  border: CHROME.border,
  muted: "rgba(255,255,255,0.45)",
  text: CHROME.white,
  displayFont: CHROME.homeDisplayFont,
  labelFont: CHROME.homeLabelFont,
  bodyFont: CHROME.homeBodyFont,
} as const

function DarkSectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-bold uppercase tracking-[0.28em] ${className}`}
      style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
    >
      {children}
    </p>
  )
}

function HomeTopBar({ guest, streak }: { guest: boolean; streak: number }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <EcgMark size={16} animate />
        <span
          className="truncate text-[11px] font-bold uppercase tracking-[0.22em] text-white"
          style={{ fontFamily: HOME.labelFont }}
        >
          FitTrack Go
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {guest ? (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
          >
            Guest
          </span>
        ) : null}
        {streak > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-px bg-white/15" aria-hidden />
            <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: HOME.accent }} aria-hidden />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] text-white"
              style={{ fontFamily: HOME.labelFont }}
            >
              {streak} day streak
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function DarkProgressBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const reduce = useReducedMotion() ?? false
  return (
    <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
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

function DarkActivityTile({
  label,
  value,
  meta,
  barColor,
  progress,
  delay,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string
  meta: string
  barColor: string
  progress: number
  delay: number
  icon: LucideIcon
  iconColor: string
}) {
  return (
    <DarkCard delay={delay} className="!rounded-2xl !bg-[#121212] !p-3.5" noAnimation={false}>
      <div className="flex items-start justify-between gap-2">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
        >
          {label}
        </p>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: `${iconColor}40`, backgroundColor: `${iconColor}18` }}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: iconColor }} />
        </span>
      </div>
      <p
        className="mt-3 text-[1.85rem] font-normal uppercase leading-none tracking-[0.02em] tabular-nums text-white"
        style={{ fontFamily: HOME.displayFont }}
      >
        {value}
      </p>
      <p
        className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
      >
        {meta}
      </p>
      <DarkProgressBar pct={progress} color={barColor} delay={delay} />
    </DarkCard>
  )
}

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
  guest?: boolean
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
    guest = false,
    loadError,
    onRetry,
    greeting,
    displayName,
    todayDateLine,
    todayPrompt,
    onPromptClick,
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
    sleepTotalMin,
    sleepGoalMin,
    fourWeekTrend,
    personalBests,
    goals,
    chartEnterAnim,
  } = props

  const weekPeak = Math.max(1, ...weekly.map((w) => w.count))
  const dayOfWeek = new Date().getDay()
  const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const sleepMin = sleepTotalMin ?? 400
  const sleepGood = sleepMin >= sleepGoalMin * 0.75
  const sleepStages = SLEEP_STAGES.map((s) => ({
    ...s,
    minutes: Math.round(sleepMin * s.ratio),
  }))

  const nameLine =
    displayName === "there"
      ? "LET'S MOVE."
      : `${displayName.charAt(0).toUpperCase()}${displayName.slice(1).toLowerCase()}.`.toUpperCase()

  const recoveryTitleText = recoveryTitle(readinessScore)
  const focusTitle = todayPrompt?.title?.toUpperCase() ?? "TRAIN"
  const greetingLine = `${greeting},`.toUpperCase()
  const recoverySubline =
    readinessScore < 60
      ? "Today is a recovery day. Your body will thank you tomorrow."
      : readinessScore < 80
        ? "Moderate load today — train smart and leave room to recover."
        : "You're primed — make today's session count."

  return (
    <div
      className="relative -mx-4 -mt-4 pb-28"
      style={{ backgroundColor: HOME.black, fontFamily: HOME.bodyFont }}
    >
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

      <header style={{ backgroundColor: HOME.black }}>
        <HomeTopBar guest={guest} streak={streak} />

        <div className="px-5 pb-5">
        <p
          className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em]"
          style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
        >
          {todayDateLine.toUpperCase()}
        </p>
        <motion.h1
          className="mt-2 text-[1.65rem] font-normal uppercase leading-[1.08] tracking-[0.02em] text-white"
          style={{ fontFamily: HOME.displayFont }}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          {greetingLine}{" "}
          <span style={{ color: HOME.accent }}>{nameLine}</span>
        </motion.h1>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: HOME.muted, fontFamily: HOME.bodyFont }}>
          {recoverySubline}
        </p>

        <motion.button
          type="button"
          onClick={todayPrompt ? onPromptClick : undefined}
          disabled={!todayPrompt}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left disabled:opacity-80"
          style={{ backgroundColor: HOME.card, borderColor: HOME.border }}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          whileTap={todayPrompt ? { scale: 0.99 } : undefined}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: HOME.accent, fontFamily: HOME.labelFont }}
            >
              Today&apos;s focus
            </p>
            <p
              className="mt-1 text-[15px] font-normal uppercase tracking-[0.06em] text-white"
              style={{ fontFamily: HOME.displayFont }}
            >
              {focusTitle}
            </p>
            {todayPrompt?.hint ? (
              <p className="mt-0.5 text-xs leading-snug" style={{ color: HOME.muted, fontFamily: HOME.bodyFont }}>
                {todayPrompt.hint}
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
        </motion.button>
        </div>
      </header>

      <div className="space-y-5 px-4 pt-1">
        <section aria-label="Readiness">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <DarkSectionLabel>Readiness</DarkSectionLabel>
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: HOME.accent, backgroundColor: HOME.accentDim, fontFamily: HOME.labelFont }}
            >
              {readinessBand}
            </span>
          </div>
          <DarkCard delay={0.04} className="!rounded-2xl !bg-[#121212]">
            <div className="flex items-start gap-4">
              <RingGauge
                value={readinessScore}
                max={100}
                size={108}
                thickness={9}
                spring
                trackClassName="stroke-white/10"
                progressClassName="stroke-[#FF4D30]"
              >
                <span
                  className="text-[2rem] font-normal tabular-nums leading-none text-white"
                  style={{ fontFamily: HOME.displayFont }}
                >
                  <AnimatedCounter value={readinessScore} />
                </span>
              </RingGauge>
              <div className="min-w-0 flex-1 pt-1">
                <p
                  className="text-sm font-normal uppercase tracking-[0.1em] text-white"
                  style={{ fontFamily: HOME.displayFont }}
                >
                  {recoveryTitleText}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: HOME.muted, fontFamily: HOME.bodyFont }}>
                  {readinessHint}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                hrvLabel !== "—" ? `HRV ${hrvLabel}` : "HRV —",
                rhrLabel !== "—" ? `RHR ${rhrLabel}` : "RHR —",
                sleepLabel ? `Sleep ${sleepLabel}` : "Sleep —",
              ].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] tabular-nums text-white/80"
                  style={{ borderColor: HOME.border, backgroundColor: "rgba(255,255,255,0.04)", fontFamily: HOME.labelFont }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </DarkCard>
        </section>

        <section aria-label="Activity today">
          <DarkSectionLabel className="mb-2.5">Activity · Today</DarkSectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <DarkActivityTile
              label="Calories"
              value={`${moveRingCalories}`}
              meta={`kcal · goal ${dailyCalorieGoal}`}
              icon={Flame}
              iconColor={HOME.accent}
              barColor={HOME.accent}
              progress={(moveRingCalories / dailyCalorieGoal) * 100}
              delay={0.08}
            />
            <DarkActivityTile
              label="Active"
              value={`${todayActiveMinutes}`}
              meta={`min · goal ${dailyActiveMinGoal}`}
              icon={Zap}
              iconColor="#3b82f6"
              barColor="#3b82f6"
              progress={(todayActiveMinutes / dailyActiveMinGoal) * 100}
              delay={0.1}
            />
            <DarkActivityTile
              label="Steps"
              value={googleFitSteps != null ? googleFitSteps.toLocaleString() : "—"}
              meta="goal 8,000"
              icon={Footprints}
              iconColor="#84cc16"
              barColor="#eab308"
              progress={googleFitSteps != null ? (googleFitSteps / 8000) * 100 : 0}
              delay={0.12}
            />
            <DarkActivityTile
              label="Hydration"
              value={`${hydrationMl}`}
              meta={`ml · goal ${hydrationGoalMl.toLocaleString()}`}
              icon={Droplets}
              iconColor="#38bdf8"
              barColor="#38bdf8"
              progress={(hydrationMl / hydrationGoalMl) * 100}
              delay={0.14}
            />
          </div>
        </section>

        <section aria-label="This week">
          <DarkSectionLabel className="mb-2.5">This Week</DarkSectionLabel>
          <DarkCard delay={0.16} className="!rounded-2xl !bg-[#121212]">
            <div className="flex items-center justify-between gap-2">
              <p
                className="text-[1.35rem] font-normal uppercase leading-tight tracking-[0.02em] text-white"
                style={{ fontFamily: HOME.displayFont }}
              >
                <AnimatedCounter value={thisWeekTotal} />{" "}
                <span className="text-base font-normal tracking-[0.08em] text-white/70">sessions</span>
              </p>
              {weekCompare !== 0 ? (
                <motion.span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{
                    color: weekCompare > 0 ? CHROME.gpsGreen : HOME.muted,
                    backgroundColor: weekCompare > 0 ? `${CHROME.gpsGreen}18` : "rgba(255,255,255,0.06)",
                  }}
                  initial={reduce ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 320, damping: 22 }}
                >
                  {weekCompare > 0 ? "+" : ""}
                  {weekCompare}%
                </motion.span>
              ) : null}
            </div>
            <div className="mt-5 flex items-end justify-between gap-1.5" style={{ height: 72 }}>
              {weekly.map((w, i) => {
                const h = (w.count / weekPeak) * 100
                const isToday = i === todayIdx
                return (
                  <div key={w.day} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <motion.div
                        className="w-full rounded-t-sm"
                        style={{
                          backgroundColor: isToday
                            ? HOME.accent
                            : w.count > 0
                              ? "rgba(255,255,255,0.35)"
                              : "rgba(255,255,255,0.12)",
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
                    <span className="text-[9px] font-bold uppercase" style={{ color: HOME.muted }}>
                      {w.day.charAt(0)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: HOME.border }}>
              <div className="text-center">
                <p
                  className="text-lg font-normal tabular-nums text-white"
                  style={{ fontFamily: HOME.displayFont }}
                >
                  {bestCoachScore > 0 ? `${bestCoachScore}%` : "—"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: HOME.muted, fontFamily: HOME.labelFont }}>
                  Form
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-lg font-normal tabular-nums"
                  style={{ color: "#60a5fa", fontFamily: HOME.displayFont }}
                >
                  {streak}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: HOME.muted, fontFamily: HOME.labelFont }}>
                  Streak
                </p>
              </div>
              <div className="text-center">
                <p
                  className="text-lg font-normal tabular-nums text-white"
                  style={{ fontFamily: HOME.displayFont }}
                >
                  {avgPace ?? "—"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: HOME.muted, fontFamily: HOME.labelFont }}>
                  Avg pace
                </p>
              </div>
            </div>
          </DarkCard>
        </section>

        <section aria-label="Sleep">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <DarkSectionLabel>Last night&apos;s sleep</DarkSectionLabel>
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ color: CHROME.gpsGreen, backgroundColor: `${CHROME.gpsGreen}18`, fontFamily: HOME.labelFont }}
            >
              {sleepGood ? "Good" : "Fair"}
            </span>
          </div>
          <DarkCard delay={0.2} className="!rounded-2xl !bg-[#121212]">
            <p
              className="text-[1.35rem] font-normal uppercase leading-tight tracking-[0.02em] text-white"
              style={{ fontFamily: HOME.displayFont }}
            >
              {formatSleep(sleepMin).replace(/\s/g, " ").toUpperCase()}{" "}
              <span className="text-sm font-semibold normal-case tracking-normal" style={{ color: HOME.muted, fontFamily: HOME.bodyFont }}>
                of {Math.round(sleepGoalMin / 60)} h goal
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
                <span key={s.key} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: HOME.muted }}>
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
                  {s.label} {formatStageMin(s.minutes)}
                </span>
              ))}
            </div>
          </DarkCard>
        </section>

        {fourWeekTrend.length >= 2 ? (
          <section aria-label="Four week trend">
            <DarkSectionLabel className="mb-2.5">4-Week Trend</DarkSectionLabel>
            <DarkCard delay={0.24} className="!rounded-2xl !bg-[#121212]">
              <div className="mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" style={{ color: HOME.accent }} aria-hidden />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: HOME.accent, fontFamily: HOME.labelFont }}
                >
                  Sessions trend
                </span>
              </div>
              <MetricTrendMini
                className="mb-2 h-24 w-full"
                points={fourWeekTrend.map((w) => ({ v: w.count }))}
                stroke={HOME.accent}
                stopColor={HOME.accent}
                isAnimationActive={chartEnterAnim}
              />
              <div className="flex justify-between gap-2 px-1">
                {fourWeekTrend.map((w, i) => {
                  const isCurrent = i === fourWeekTrend.length - 1
                  return (
                  <div key={w.label} className="flex flex-1 flex-col items-center gap-0.5">
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
                    >
                      {w.label}
                    </span>
                    <span
                      className="text-sm font-normal tabular-nums"
                      style={{
                        color: isCurrent ? HOME.accent : HOME.text,
                        fontFamily: HOME.displayFont,
                      }}
                    >
                      {w.count}
                    </span>
                  </div>
                  )
                })}
              </div>
            </DarkCard>
          </section>
        ) : null}

        <section aria-label="Personal bests">
          <DarkSectionLabel className="mb-2.5">Personal Bests</DarkSectionLabel>
          <DarkCard delay={0.28} className="!rounded-2xl !bg-[#121212] pb-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: "Long run",
                  value: personalBests.longestRunKm > 0 ? personalBests.longestRunKm.toFixed(1) : "—",
                  unit: "km",
                  badge: null as string | null,
                },
                {
                  label: "Best pace",
                  value: personalBests.fastestPace ?? "—",
                  unit: "/km",
                  badge: null,
                },
                {
                  label: "Form score",
                  value: personalBests.bestCoachScore > 0 ? `${personalBests.bestCoachScore}%` : "—",
                  unit: "",
                  badge: personalBests.bestCoachScore >= 95 ? "Best ever" : null,
                },
                {
                  label: "Streak",
                  value: `${personalBests.longestStreak}`,
                  unit: "d",
                  badge: null,
                },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  className="relative rounded-xl border px-3 py-3 text-center"
                  style={{ borderColor: HOME.border, backgroundColor: "rgba(255,255,255,0.03)" }}
                  initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  {item.badge ? (
                    <span
                      className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                      style={{ color: HOME.accent, backgroundColor: HOME.accentDim, fontFamily: HOME.labelFont }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                  <p
                    className="text-xl font-normal uppercase tabular-nums text-white"
                    style={{ fontFamily: HOME.displayFont }}
                  >
                    {item.value}
                    {item.unit ? (
                      <span
                        className="text-xs font-semibold normal-case tracking-normal"
                        style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
                      >
                        {" "}
                        {item.unit}
                      </span>
                    ) : null}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: HOME.muted, fontFamily: HOME.labelFont }}
                  >
                    {item.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </DarkCard>
        </section>

        {goals.length > 0 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            {goals.slice(0, 2).map((g) => (
              <span
                key={g}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: HOME.text, borderColor: HOME.border, backgroundColor: HOME.card, fontFamily: HOME.labelFont }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: HOME.accent }} aria-hidden />
                Goal: {g}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
