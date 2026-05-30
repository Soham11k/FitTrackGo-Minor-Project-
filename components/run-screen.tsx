"use client"

import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Heart, Square } from "lucide-react"
import { CHROME } from "@/lib/app-chrome"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import type { RunState } from "@/components/run-tracker"

// ── Types ──────────────────────────────────────────────────────────────────

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
  /** Called by START RUN button when idle */
  onStart: () => void
  /** Pause during active run */
  onPause: () => void
  /** Resume from paused */
  onResume: () => void
  /** Stop + save */
  onStop: () => void
  savingRun: boolean
  guest?: boolean
  streakDays?: number
  insecureGpsReminder?: boolean
  /** Slot for the live RunMap component (only supplied when running/paused) */
  mapSlot?: React.ReactNode
  formatTime: (s: number) => string
}

// ── ECG icon (inline JSX, avoids dangerouslySetInnerHTML) ─────────────────

function EcgMark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M2 16 L8 16 L11 8 L16 24 L20 12 L24 16 L30 16"
        stroke={CHROME.orange}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Stylised map hero (idle only) ──────────────────────────────────────────

/**
 * SVG-only map hero: a dark-grid background, three animated
 * grey contour paths, and a pulsing orange location dot — identical to the mock.
 */
function RunMapHero({ reduce }: { reduce: boolean }) {
  const paths = [
    "M -20 80  C 60 50, 140 110, 220 70  S 360 40, 500 80",
    "M -20 120 C 60 90, 130 150, 240 110 S 380 75, 500 120",
    "M -20 160 C 80 135, 150 185, 260 148 S 400 115, 500 155",
  ]

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 220, backgroundColor: "#111113" }}
      aria-hidden
    >
      {/* Subtle grid */}
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#444" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Animated contour paths */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 220" preserveAspectRatio="xMidYMid slice">
        {paths.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="#3a3a3e"
            strokeWidth="2"
            strokeLinecap="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: [0.35, 0.6, 0.35] }}
            transition={
              reduce
                ? {}
                : {
                    pathLength: { duration: 1.4, delay: i * 0.18, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 3.5, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" },
                  }
            }
          />
        ))}
      </svg>

      {/* Orange GPS dot + glow ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        {!reduce && (
          <motion.span
            className="absolute rounded-full"
            style={{ width: 36, height: 36, backgroundColor: `${CHROME.orange}25` }}
            animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span
          className="relative h-4 w-4 rounded-full shadow-lg"
          style={{
            backgroundColor: CHROME.orange,
            boxShadow: `0 0 12px 4px ${CHROME.orange}55`,
          }}
        />
      </div>
    </div>
  )
}

// ── GPS pill ───────────────────────────────────────────────────────────────

function GpsPill({ status, label, reduce }: { status: GpsStatus; label: string; reduce: boolean }) {
  const locked = status === "good"
  const dotColor = locked ? CHROME.gpsGreen : "#facc15"

  return (
    <div className="flex justify-center">
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-1.5"
        style={{ backgroundColor: "#1e1e20", border: `1px solid ${CHROME.border}` }}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          {!reduce && !locked && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full"
              style={{ backgroundColor: dotColor }}
              animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={label}
            className="text-[11px] font-semibold text-white/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Hairline divider ───────────────────────────────────────────────────────

function HDivider() {
  return <div className="w-full" style={{ height: 1, backgroundColor: "#262628" }} />
}

function VDivider() {
  return <div className="self-stretch" style={{ width: 1, backgroundColor: "#262628" }} />
}

// ── Stat cell ──────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  unit,
  delay,
  reduce,
  animate: shouldAnimate = false,
  numericValue,
}: {
  label: string
  value: string
  unit?: string
  delay?: number
  reduce: boolean
  animate?: boolean
  numericValue?: number
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-start px-4 py-3"
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay ?? 0, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-[0.22em]"
        style={{ color: CHROME.muted }}
      >
        {label}
      </span>
      <p className="mt-1 text-xl font-bold tabular-nums text-white">
        {shouldAnimate && numericValue != null ? (
          <AnimatedCounter value={numericValue} decimals={value.includes(".") ? 2 : 0} />
        ) : (
          value
        )}
        {unit ? (
          <span className="ml-1 text-xs font-semibold" style={{ color: CHROME.muted }}>
            {unit}
          </span>
        ) : null}
      </p>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

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

  return (
    <div
      className="flex min-h-[calc(100dvh-0px)] flex-col"
      style={{ backgroundColor: CHROME.black }}
    >
      {/* ── Chrome header ───────────────────────────────────────────── */}
      <motion.header
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-1.5">
          <EcgMark size={16} />
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">
            FitTrack Go
          </span>
        </div>
        <div className="flex items-center gap-2">
          {guest && (
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: CHROME.muted }}>
              Guest
            </span>
          )}
          {streakDays > 0 && (
            <motion.span
              className="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white"
              style={{ backgroundColor: CHROME.orange }}
              animate={reduce ? undefined : { opacity: [0.85, 1, 0.85] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {streakDays}D Streak
            </motion.span>
          )}
        </div>
      </motion.header>

      {/* ── Map hero (idle: SVG; running/paused: real map slot) ─────── */}
      <div className="relative flex-shrink-0 overflow-hidden" style={{ height: isIdle ? 220 : "42vh" }}>
        {isIdle ? (
          <RunMapHero reduce={reduce} />
        ) : (
          <div className="absolute inset-0">
            {mapSlot}
            {/* Dark overlay so HUD text stays legible */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.55) 100%)" }}
            />
          </div>
        )}

        {/* GPS pill — always visible, overlaid on hero */}
        {(isIdle || isRunning || isPaused) && (
          <div className="absolute bottom-3 left-0 right-0 z-10">
            <GpsPill status={gpsStatus} label={gpsLabel} reduce={reduce} />
          </div>
        )}

        {insecureGpsReminder && (
          <div className="absolute top-2 left-4 right-4 z-10 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-center text-[11px] text-yellow-200/90">
            Live GPS needs <strong>localhost</strong> or <strong>HTTPS</strong>.
          </div>
        )}
      </div>

      {/* ── Metrics panel ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col" style={{ backgroundColor: "#0f0f11" }}>
        {/* OUTDOOR RUN eyebrow + PACE hero */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: CHROME.muted }}>
            Outdoor run
          </p>
          <div className="mt-1 flex items-baseline gap-1">
            <motion.p
              className="text-[4.5rem] font-bold leading-none tabular-nums text-white"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              {pace}
            </motion.p>
            <span className="text-2xl font-semibold" style={{ color: CHROME.muted }}>
              /km
            </span>
            {!isIdle && (
              <span
                className="ml-2 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: CHROME.orange }}
              >
                PACE
              </span>
            )}
          </div>
        </div>

        <HDivider />

        {/* LIVE HR + CALORIES */}
        <motion.div
          className="flex items-center justify-between px-4 py-2.5"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={reduce || !isRunning ? undefined : { scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <Heart className="h-4 w-4 fill-current" style={{ color: CHROME.hrRed }} aria-hidden />
            </motion.div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: CHROME.hrRed }}>
                Live HR
              </p>
              <p className="text-sm font-bold text-white">
                {heartBpm != null ? heartBpm : "—"}{" "}
                <span className="text-xs font-semibold" style={{ color: CHROME.muted }}>
                  bpm
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: CHROME.muted }}>
              Calories
            </p>
            <p className="text-sm font-bold tabular-nums text-white">
              {isRunning ? (
                <AnimatedCounter value={Math.round(calories)} />
              ) : (
                Math.round(calories)
              )}{" "}
              <span className="text-xs font-semibold" style={{ color: CHROME.muted }}>
                kcal
              </span>
            </p>
          </div>
        </motion.div>

        <HDivider />

        {/* DISTANCE | TIME | CADENCE */}
        <div className="flex">
          <StatCell
            label="Distance"
            value={distance.toFixed(2)}
            unit="km"
            delay={0.12}
            reduce={reduce}
            animate={isRunning}
            numericValue={distance}
          />
          <VDivider />
          <StatCell
            label="Time"
            value={formatTime(seconds)}
            delay={0.15}
            reduce={reduce}
          />
          <VDivider />
          <StatCell
            label="Cadence"
            value="—"
            unit="spm"
            delay={0.18}
            reduce={reduce}
          />
        </div>

        <HDivider />

        {/* SPLITS */}
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em]" style={{ color: CHROME.muted }}>
            Splits
          </p>
          {splits.length === 0 ? (
            <p className="mt-1.5 text-sm italic" style={{ color: "#555" }}>
              No splits yet — start your run
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              <AnimatePresence initial={false}>
                {splits.map((lap) => (
                  <motion.div
                    key={lap.lap}
                    className="flex items-center justify-between"
                    initial={reduce ? false : { opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: CHROME.muted }}>
                      Km {lap.lap}
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-white">{lap.pace}/km</span>
                    <span className="text-[11px] tabular-nums" style={{ color: CHROME.muted }}>
                      {formatTime(lap.time)}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Controls ──────────────────────────────────────────────── */}
        <div
          className="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {isIdle && (
            <motion.button
              layoutId="run-start-button"
              type="button"
              onClick={onStart}
              className="relative flex w-full items-center justify-center overflow-hidden rounded-2xl py-5"
              style={{
                backgroundColor: "#1a1a1c",
                border: `1.5px solid #333336`,
              }}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.12 }}
              aria-label="Start run"
            >
              {/* Shimmer sweep */}
              {!reduce && (
                <motion.span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.06) 50%, transparent 65%)",
                    backgroundSize: "200% 100%",
                  }}
                  animate={{ backgroundPosition: ["-100% 0", "200% 0"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 0.8 }}
                />
              )}
              <span className="text-xl font-black uppercase tracking-[0.14em] text-white">
                Start Run
              </span>
              <span
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: "#2a2a2e" }}
                aria-hidden
              >
                <Square className="h-3.5 w-3.5 fill-white text-white" />
              </span>
            </motion.button>
          )}

          {(isRunning || isPaused) && (
            <div className="flex items-center gap-4">
              {/* Stop */}
              <button
                type="button"
                onClick={onStop}
                disabled={savingRun}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 disabled:opacity-60"
                style={{ borderColor: CHROME.hrRed, color: CHROME.hrRed }}
                aria-label="Stop run"
              >
                {savingRun ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide">Saving</span>
                ) : (
                  <Square className="h-5 w-5 fill-current" />
                )}
              </button>

              {/* Pause / Resume */}
              <motion.button
                layoutId="run-start-button"
                type="button"
                onClick={isRunning ? onPause : onResume}
                className="flex flex-1 items-center justify-center rounded-2xl py-4 text-lg font-black uppercase tracking-[0.12em] text-white"
                style={{ backgroundColor: CHROME.orange }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                aria-label={isRunning ? "Pause run" : "Resume run"}
              >
                {isRunning ? "Pause" : "Resume"}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
