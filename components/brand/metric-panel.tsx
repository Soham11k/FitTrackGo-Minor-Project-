"use client"

import type { LucideIcon } from "lucide-react"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { AnimatedCounter } from "@/components/animated/AnimatedCounter"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export type MetricTone = "default" | "move" | "run" | "coach" | "streak" | "steps" | "hr" | "stage"

const toneBg: Record<MetricTone, string> = {
  default: "bg-card border-border/60",
  move:    "bg-metric-move/12 border-metric-move/30",
  run:     "bg-metric-run/12 border-metric-run/30",
  coach:   "bg-metric-coach/12 border-metric-coach/30",
  streak:  "bg-metric-streak/12 border-metric-streak/30",
  steps:   "bg-metric-steps/12 border-metric-steps/30",
  hr:      "bg-metric-hr/12 border-metric-hr/30",
  stage:   "border-[color:var(--surface-stage-hairline)] bg-white/5",
}

const toneIconBg: Record<MetricTone, string> = {
  default: "bg-foreground/10 text-foreground",
  move:    "bg-metric-move text-black",
  run:     "bg-metric-run text-white",
  coach:   "bg-metric-coach text-white",
  streak:  "bg-metric-streak text-black",
  steps:   "bg-metric-steps text-white",
  hr:      "bg-metric-hr text-white",
  stage:   "bg-white/15 text-white",
}

const toneBar: Record<MetricTone, string> = {
  default: "bg-foreground/20",
  move:    "bg-metric-move",
  run:     "bg-metric-run",
  coach:   "bg-metric-coach",
  streak:  "bg-metric-streak",
  steps:   "bg-metric-steps",
  hr:      "bg-metric-hr",
  stage:   "bg-white/60",
}

const toneValue: Record<MetricTone, string> = {
  default: "text-foreground",
  move:    "text-foreground",
  run:     "text-foreground",
  coach:   "text-foreground",
  streak:  "text-foreground",
  steps:   "text-foreground",
  hr:      "text-foreground",
  stage:   "text-[color:var(--surface-stage-fg)]",
}

/** Fitbit-style compact metric tile — with colored icon badge and optional progress bar. */
export function MetricTile({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
  className,
  delta,
  progress,
  /** When set, uses AnimatedCounter to tween the numeric value */
  numericValue,
  children,
}: {
  label: string
  value: string
  unit?: string
  icon?: LucideIcon
  tone?: MetricTone
  className?: string
  delta?: string
  /** 0–100 progress for bottom bar. Omit to hide. */
  progress?: number
  /** Raw numeric for AnimatedCounter animation. If provided, replaces static value text. */
  numericValue?: number
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion() ?? false
  const labelCls = tone === "stage" ? "text-white/55" : "text-muted-foreground"
  const unitCls  = tone === "stage" ? "text-white/55" : "text-muted-foreground"

  return (
    <motion.div
      className={cn("fitbit-tile relative flex flex-col justify-between overflow-hidden pb-2", toneBg[tone], className)}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Top: icon badge + label */}
      <div className="flex items-start justify-between gap-1.5">
        <p className={cn("text-typo-eyebrow font-bold uppercase tracking-[0.16em]", labelCls)}>{label}</p>
        {Icon ? (
          <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", toneIconBg[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </div>

      {children}

      {/* Stat number */}
      <p
        className={cn("mt-2 text-xl font-bold tabular-nums leading-none sm:text-2xl", toneValue[tone])}
        style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
      >
        {numericValue != null ? (
          <AnimatedCounter
            value={numericValue}
            decimals={value.includes(".") ? 1 : 0}
            className="tabular-nums"
            unit={unit}
            unitClassName={cn("ml-1 text-sm font-semibold", unitCls)}
          />
        ) : (
          <>
            {value}
            {unit ? <span className={cn("ml-1 text-sm font-semibold", unitCls)}>{unit}</span> : null}
          </>
        )}
      </p>

      {delta ? <p className="mt-1 text-typo-caption text-muted-foreground">{delta}</p> : null}

      {/* Animated progress bar */}
      {progress != null ? (
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/8 overflow-hidden rounded-b-[inherit]">
          <motion.div
            className={cn("h-full rounded-full", toneBar[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
          />
        </div>
      ) : null}
    </motion.div>
  )
}

export function MetricGrid({
  children,
  className,
  cols = 3,
}: {
  children: React.ReactNode
  className?: string
  cols?: 2 | 3
}) {
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : "grid-cols-3", className)}>{children}</div>
  )
}

export function MetricPanel({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("nrc-card p-4", className)}>
      {title ? (
        <h2 className="mb-3 text-typo-eyebrow font-bold uppercase tracking-[0.22em] text-muted-foreground">{title}</h2>
      ) : null}
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  )
}

export function MetricRow({
  icon: Icon,
  label,
  value,
  delta,
  points,
  tone = "default",
}: {
  icon?: LucideIcon
  label: string
  value: string
  delta?: string
  points?: Array<{ v: number }>
  tone?: MetricTone
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {Icon ? (
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", toneIconBg[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-typo-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p
          className="mt-0.5 text-xl font-bold text-foreground tabular-nums"
          style={{ fontFamily: "var(--font-display), var(--font-heading)" }}
        >
          {value}
        </p>
        {delta ? <p className="mt-0.5 text-xs text-muted-foreground">{delta}</p> : null}
      </div>
      {points && points.length > 1 ? (
        <MetricTrendMini
          points={points}
          stroke={`var(--${tone === "default" ? "primary" : `metric-${tone === "steps" ? "steps" : tone}`})`}
          stopColor={`var(--${tone === "default" ? "primary" : `metric-${tone === "steps" ? "steps" : tone}`})`}
          className="h-12 w-[7.5rem] shrink-0"
        />
      ) : null}
    </div>
  )
}
