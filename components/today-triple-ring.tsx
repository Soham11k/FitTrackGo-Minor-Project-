"use client"

import { Flame, Timer, Activity } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { RingGauge } from "@/components/ring-gauge"
import { DURATION, EASE } from "@/lib/motion"
import { cn } from "@/lib/utils"

export type TodayTripleRingProps = {
  calories: number
  calorieGoal: number
  activeMinutes: number
  activeMinGoal: number
  sessions: number
  sessionGoal: number
  /** Shown under Move goal line (e.g. Google Fit steps). */
  moveFootnote?: string | null
  className?: string
}

/** Apple-style triple close: Move (cal), Exercise (active min), Sessions (count). */
export function TodayTripleRing({
  calories,
  calorieGoal,
  activeMinutes,
  activeMinGoal,
  sessions,
  sessionGoal,
  moveFootnote,
  className,
}: TodayTripleRingProps) {
  const reduce = useReducedMotion() ?? false
  const movePct = Math.min(100, (calories / Math.max(1, calorieGoal)) * 100)
  const exPct = Math.min(100, (activeMinutes / Math.max(1, activeMinGoal)) * 100)
  const sessPct = Math.min(100, (sessions / Math.max(1, sessionGoal)) * 100)

  return (
    <motion.div
      className={cn(
        "nrc-card flex flex-wrap items-start justify-between gap-4 p-4",
        className
      )}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.medium, ease: EASE.out }}
    >
      <div className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1">
        <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Move</span>
        <RingGauge value={movePct} max={100} size={88} thickness={7} spring progressClassName="stroke-metric-hr">
          <Flame className="h-4 w-4 text-metric-hr" />
          <span className="text-lg font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {calories}
          </span>
        </RingGauge>
        <span className="text-typo-caption text-muted-foreground tabular-nums">/ {calorieGoal} cal</span>
        {moveFootnote ? (
          <span className="max-w-[10rem] text-center text-typo-micro leading-tight text-muted-foreground">{moveFootnote}</span>
        ) : null}
      </div>
      <div className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1">
        <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Exercise</span>
        <RingGauge value={exPct} max={100} size={88} thickness={7} spring progressClassName="stroke-metric-move">
          <Timer className="h-4 w-4 text-metric-move" />
          <span className="text-lg font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {activeMinutes}
          </span>
        </RingGauge>
        <span className="text-typo-caption text-muted-foreground tabular-nums">/ {activeMinGoal} min</span>
      </div>
      <div className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-1">
        <span className="text-typo-micro font-bold uppercase tracking-wider text-muted-foreground">Sessions</span>
        <RingGauge
          value={sessPct}
          max={100}
          size={88}
          thickness={7}
          spring
          progressClassName={sessions > 0 ? "live-pulse stroke-primary" : "stroke-primary"}
        >
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-lg font-bold tabular-nums text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {sessions}
          </span>
        </RingGauge>
        <span className="text-typo-caption text-muted-foreground tabular-nums">/ {sessionGoal} today</span>
      </div>
    </motion.div>
  )
}
