"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
  ChevronDown,
  Flame,
  Heart,
  Pause,
  Play,
  Square,
} from "lucide-react"
import { CHROME } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"
import { EcgMark } from "@/components/chrome/EcgMark"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import type { RunState } from "@/components/run-tracker"

export type GpsStatus = "off" | "searching" | "good" | "simulated"

export interface RunSplit {
  lap: number
  distance: number
  time: number
  pace: string
}

export interface RunScreenProps {
  runState: RunState
  gpsStatus: GpsStatus
  gpsLabel: string
  pace: string
  distance: number
  seconds: number
  calories: number
  heartBpm: number | null
  splits: RunSplit[]
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  savingRun: boolean
  guest?: boolean
  streakDays?: number
  insecureGpsReminder?: boolean
  mapSlot?: React.ReactNode
  formatTime: (s: number) => string
}

const RUN = {
  black: CHROME.homeBlack,
  card: CHROME.homeCard,
  accent: CHROME_ACCENT.accent,
  accentDim: CHROME_ACCENT.accentDim,
  muted: "rgba(255,255,255,0.45)",
  border: CHROME.border,
  divider: "#262628",
  green: CHROME.gpsGreen,
  displayFont: CHROME.homeDisplayFont,
  labelFont: CHROME.homeLabelFont,
  bodyFont: CHROME.homeBodyFont,
} as const

function RunEyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`text-[10px] font-bold uppercase tracking-[0.26em] ${className}`}
      style={{ color: RUN.muted, fontFamily: RUN.labelFont }}
    >
      {children}
    </p>
  )
}

function HDivider() {
  return <div className="h-px w-full" style={{ backgroundColor: RUN.divider }} />
}

function VDivider() {
  return <div className="w-px self-stretch shrink-0" style={{ backgroundColor: RUN.divider }} />
}

function StatusDot({ color, pulse = false, reduce = false }: { color: string; pulse?: boolean; reduce?: boolean }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && !reduce ? (
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ scale: [1, 1.75], opacity: [0.7, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
        />
      ) : null}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  )
}

function RunHeader({ guest, streakDays }: { guest?: boolean; streakDays: number }) {
  return (
    <header
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <EcgMark size={16} color={RUN.accent} animate />
        <span
          className="truncate text-[11px] font-bold uppercase tracking-[0.22em] text-white"
          style={{ fontFamily: RUN.labelFont }}
        >
          FitTrack Go
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {guest ? (
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: RUN.muted, fontFamily: RUN.labelFont }}
          >
            Guest
          </span>
        ) : null}
        {streakDays > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-px bg-white/15" aria-hidden />
            <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: RUN.accent }} aria-hidden />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] text-white"
              style={{ fontFamily: RUN.labelFont }}
            >
              {streakDays}d streak
            </span>
          </span>
        ) : null}
      </div>
    </header>
  )
}

function RunMapHero({ reduce, isLive, distanceKm }: { reduce: boolean; isLive: boolean; distanceKm: number }) {
  const paths = [
    "M -20 80  C 60 50, 140 110, 220 70  S 360 40, 500 80",
    "M -20 120 C 60 90, 130 150, 240 110 S 380 75, 500 120",
  ]

  return (
    <div className="relative h-[200px] w-full overflow-hidden rounded-2xl" style={{ backgroundColor: RUN.card }}>
      <svg className="absolute inset-0 h-full w-full opacity-15" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="run-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#555" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#run-grid)" />
      </svg>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 200" preserveAspectRatio="xMidYMid slice">
        {paths.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke={i === 0 && isLive ? RUN.accent : "#3a3a3e"}
            strokeWidth={i === 0 && isLive ? 2.5 : 2}
            strokeLinecap="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: isLive ? 1 : [0.35, 0.55, 0.35] }}
            transition={
              reduce
                ? {}
                : {
                    pathLength: { duration: 1.2, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 3, repeat: isLive ? 0 : Infinity, delay: i * 0.5, ease: "easeInOut" },
                  }
            }
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {!reduce && !isLive ? (
          <motion.span
            className="absolute rounded-full"
            style={{ width: 32, height: 32, backgroundColor: `${RUN.accent}22` }}
            animate={{ scale: [1, 1.7, 1], opacity: [0.45, 0, 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <span
          className="relative h-3.5 w-3.5 rounded-full"
          style={{ backgroundColor: RUN.accent, boxShadow: `0 0 10px 3px ${RUN.accent}55` }}
        />
      </div>

      <div className="absolute left-3.5 top-3.5 flex items-center gap-2">
        <StatusDot color={RUN.accent} pulse={isLive} reduce={reduce} />
        <span
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-white"
          style={{ fontFamily: RUN.labelFont }}
        >
          {isLive ? "Live" : "Ready"}
        </span>
      </div>

      <div className="absolute right-3.5 top-3.5">
        {isLive ? (
          <span
            className="text-[11px] font-normal uppercase tracking-[0.06em] tabular-nums text-white"
            style={{ fontFamily: RUN.displayFont }}
          >
            {distanceKm.toFixed(2)} km
          </span>
        ) : (
          <RunEyebrow>Outdoor run</RunEyebrow>
        )}
      </div>
    </div>
  )
}

function RunHeroCard({
  isIdle,
  isLive,
  distance,
  reduce,
  mapSlot,
  insecureGpsReminder,
}: {
  isIdle: boolean
  isLive: boolean
  distance: number
  reduce: boolean
  mapSlot?: React.ReactNode
  insecureGpsReminder?: boolean
}) {
  return (
    <div className="relative px-4 pb-1">
      {isIdle ? (
        <RunMapHero reduce={reduce} isLive={false} distanceKm={distance} />
      ) : (
        <div className="relative h-[200px] w-full overflow-hidden rounded-2xl" style={{ backgroundColor: RUN.card }}>
          <div className="absolute inset-0">{mapSlot}</div>
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.55) 100%)" }}
          />
          <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2">
            <StatusDot color={RUN.accent} pulse reduce={reduce} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.14em] text-white"
              style={{ fontFamily: RUN.labelFont }}
            >
              Live
            </span>
          </div>
          <div className="pointer-events-none absolute right-3.5 top-3.5">
            <span
              className="text-[11px] font-normal uppercase tracking-[0.06em] tabular-nums text-white"
              style={{ fontFamily: RUN.displayFont }}
            >
              {distance.toFixed(2)} km
            </span>
          </div>
        </div>
      )}

      {insecureGpsReminder ? (
        <div className="absolute left-4 right-4 top-2 z-10 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center text-[11px] text-yellow-200/90">
          Live GPS needs <strong>localhost</strong> or <strong>HTTPS</strong>.
        </div>
      ) : null}
    </div>
  )
}

function PaceHero({ pace, reduce }: { pace: string; reduce: boolean }) {
  return (
    <div className="px-4 pt-4 pb-3">
      <RunEyebrow>Pace</RunEyebrow>
      <motion.div
        className="mt-1 flex items-baseline gap-1"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <span
          className="text-[4.25rem] font-normal uppercase leading-none tabular-nums text-white"
          style={{ fontFamily: RUN.displayFont }}
        >
          {pace}
        </span>
        <span
          className="text-xl font-normal uppercase tracking-[0.04em]"
          style={{ color: RUN.muted, fontFamily: RUN.displayFont }}
        >
          /km
        </span>
      </motion.div>
    </div>
  )
}

function GpsStatusLine({
  gpsStatus,
  gpsLabel,
  isIdle,
  reduce,
}: {
  gpsStatus: GpsStatus
  gpsLabel: string
  isIdle: boolean
  reduce: boolean
}) {
  const locked = gpsStatus === "good"
  const text =
    isIdle && locked
      ? "GPS locked · Waiting to start"
      : gpsLabel

  return (
    <div className="flex items-center gap-2 px-4 pb-3">
      <StatusDot color={locked ? RUN.accent : "#facc15"} pulse={!locked} reduce={reduce} />
      <span className="text-[12px]" style={{ color: RUN.muted, fontFamily: RUN.bodyFont }}>
        {text}
      </span>
    </div>
  )
}

function MetricBlock({
  label,
  value,
  sub,
  icon,
  valueColor = RUN.accent,
  animate,
  numericValue,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  valueColor?: string
  animate?: boolean
  numericValue?: number
}) {
  return (
    <div className="flex flex-1 flex-col px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <RunEyebrow className="!text-[9px] !tracking-[0.2em]">{label}</RunEyebrow>
      </div>
      <p
        className="mt-1.5 text-[1.65rem] font-normal uppercase leading-none tabular-nums"
        style={{ color: valueColor, fontFamily: RUN.displayFont }}
      >
        {animate && numericValue != null ? (
          <AnimatedCounter value={numericValue} decimals={value.includes(".") ? 2 : 0} />
        ) : (
          value
        )}
      </p>
      {sub ? (
        <p className="mt-1 text-[11px]" style={{ color: RUN.muted, fontFamily: RUN.bodyFont }}>
          {sub}
        </p>
      ) : null}
    </div>
  )
}

export function RunScreen({
  runState,
  gpsStatus,
  gpsLabel,
  pace,
  distance,
  seconds,
  calories,
  heartBpm,
  splits,
  onStart,
  onPause,
  onResume,
  onStop,
  savingRun,
  guest,
  streakDays = 0,
  insecureGpsReminder,
  mapSlot,
  formatTime,
}: RunScreenProps) {
  const reduce = useReducedMotion() ?? false
  const isIdle = runState === "idle"
  const isRunning = runState === "running"
  const isPaused = runState === "paused"
  const isActive = isRunning || isPaused

  return (
    <div
      className="flex min-h-[calc(100dvh-0px)] flex-col pb-24"
      style={{ backgroundColor: RUN.black, fontFamily: RUN.bodyFont }}
    >
      <RunHeader guest={guest} streakDays={streakDays} />

      <RunHeroCard
        isIdle={isIdle}
        isLive={isActive}
        distance={distance}
        reduce={reduce}
        mapSlot={mapSlot}
        insecureGpsReminder={insecureGpsReminder}
      />

      <div className="flex flex-1 flex-col" style={{ backgroundColor: RUN.black }}>
        <PaceHero pace={pace} reduce={reduce} />

        {isIdle ? (
          <GpsStatusLine gpsStatus={gpsStatus} gpsLabel={gpsLabel} isIdle reduce={reduce} />
        ) : null}

        {isActive && distance > 0.05 ? (
          <div className="px-4 pb-3">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: `${RUN.green}18`, color: RUN.green, fontFamily: RUN.labelFont }}
            >
              <StatusDot color={RUN.green} reduce={reduce} />
              On pace
            </span>
          </div>
        ) : null}

        <HDivider />

        <div className="flex">
          <MetricBlock
            label="Live HR"
            value={heartBpm != null ? String(heartBpm) : "—"}
            sub="bpm"
            icon={<Heart className="h-3.5 w-3.5 fill-current" style={{ color: RUN.accent }} aria-hidden />}
            valueColor={isActive && heartBpm != null ? RUN.accent : RUN.accent}
            animate={isRunning && heartBpm != null}
            numericValue={heartBpm ?? undefined}
          />
          <VDivider />
          <MetricBlock
            label="Calories"
            value={String(Math.round(calories))}
            sub="kcal"
            icon={<Flame className="h-3.5 w-3.5" style={{ color: "#fbbf24" }} aria-hidden />}
            valueColor="#ffffff"
            animate={isRunning}
            numericValue={Math.round(calories)}
          />
        </div>

        <HDivider />

        <div className="flex">
          <MetricBlock
            label="Distance"
            value={distance.toFixed(2)}
            sub="km"
            valueColor={isActive ? RUN.green : "#ffffff"}
            animate={isRunning}
            numericValue={distance}
          />
          <VDivider />
          <MetricBlock label="Time" value={formatTime(seconds)} sub="min" valueColor="#ffffff" />
          <VDivider />
          <MetricBlock label="Cadence" value="—" sub="spm" valueColor="#ffffff" />
        </div>

        <HDivider />

        <div className="flex-1 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <RunEyebrow>Splits</RunEyebrow>
            {splits.length > 0 ? (
              <span
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: RUN.accent, fontFamily: RUN.labelFont }}
              >
                {splits.length} completed
              </span>
            ) : null}
          </div>

          <div
            className="mb-2 grid grid-cols-3 gap-2 px-0.5"
            style={{ color: RUN.muted, fontFamily: RUN.labelFont }}
          >
            {["Km", "Pace", "HR"].map((h) => (
              <span key={h} className="text-[9px] font-bold uppercase tracking-[0.18em]">
                {h}
              </span>
            ))}
          </div>

          {splits.length === 0 ? (
            <p className="py-6 text-center text-[13px]" style={{ color: RUN.muted }}>
              No splits yet — start your run
            </p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {splits.map((lap, i) => (
                  <motion.div
                    key={lap.lap}
                    className="grid grid-cols-3 gap-2 tabular-nums"
                    initial={reduce ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span
                      className="text-sm font-normal text-white"
                      style={{ fontFamily: RUN.displayFont }}
                    >
                      {lap.lap}
                    </span>
                    <span
                      className="text-sm font-normal"
                      style={{
                        color: i === splits.length - 1 ? RUN.green : "#ffffff",
                        fontFamily: RUN.displayFont,
                      }}
                    >
                      {lap.pace}
                    </span>
                    <span className="text-sm text-white/70" style={{ fontFamily: RUN.displayFont }}>
                      —
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div
          className="px-4 pt-2"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {isIdle ? (
            <>
              <motion.button
                type="button"
                onClick={onStart}
                className="flex w-full items-center justify-center gap-4 rounded-2xl border py-4"
                style={{ borderColor: RUN.border, backgroundColor: RUN.card }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                aria-label="Start run"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full border"
                  style={{ borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  <Play className="ml-0.5 h-4 w-4 fill-white text-white" aria-hidden />
                </span>
                <span
                  className="text-2xl font-normal uppercase tracking-[0.12em] text-white"
                  style={{ fontFamily: RUN.displayFont }}
                >
                  Run
                </span>
                <ChevronDown className="h-4 w-4 text-white/50" aria-hidden />
              </motion.button>
              <p className="mt-3 text-center text-[11px]" style={{ color: RUN.muted }}>
                Tap to begin · GPS auto-locks on first step
              </p>
            </>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={isRunning ? onPause : onResume}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4"
                style={{ backgroundColor: RUN.card, border: `1px solid ${RUN.border}` }}
                aria-label={isRunning ? "Pause run" : "Resume run"}
              >
                <Pause className="h-4 w-4 text-white" aria-hidden />
                <span
                  className="text-sm font-bold uppercase tracking-[0.14em] text-white"
                  style={{ fontFamily: RUN.labelFont }}
                >
                  {isRunning ? "Pause" : "Resume"}
                </span>
              </button>
              <button
                type="button"
                onClick={onStop}
                disabled={savingRun}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 py-4 disabled:opacity-60"
                style={{ borderColor: RUN.accent, backgroundColor: RUN.accentDim }}
                aria-label="Finish run"
              >
                <Square className="h-3.5 w-3.5 fill-current text-white" aria-hidden />
                <span
                  className="text-sm font-bold uppercase tracking-[0.14em] text-white"
                  style={{ fontFamily: RUN.labelFont }}
                >
                  {savingRun ? "Saving…" : "Finish"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
