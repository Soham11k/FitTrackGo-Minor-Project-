"use client"

import type { LucideIcon } from "lucide-react"
import { MetricTrendMini } from "@/components/metric-trend-mini"
import { cn } from "@/lib/utils"

/** Fitbit/Google-Health style compact metric tile for grid layouts. */
export function MetricTile({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string
  value: string
  unit?: string
  icon?: LucideIcon
  tone?: "default" | "move" | "run" | "coach" | "streak" | "stage"
  className?: string
}) {
  const toneBg = {
    default: "bg-muted/30 border-border/70",
    move: "bg-metric-move/10 border-metric-move/25",
    run: "bg-metric-run/10 border-metric-run/25",
    coach: "bg-metric-coach/10 border-metric-coach/25",
    streak: "bg-metric-streak/10 border-metric-streak/25",
    stage: "border-[color:var(--surface-stage-hairline)] bg-white/8",
  }[tone]
  const labelCls = tone === "stage" ? "text-white/55" : "text-muted-foreground"
  const valueCls = tone === "stage" ? "text-[color:var(--surface-stage-fg)]" : "text-foreground"
  const unitCls = tone === "stage" ? "text-white/55" : "text-muted-foreground"

  return (
    <div className={cn("rounded-2xl border p-3.5 min-h-[5.5rem] flex flex-col justify-between", toneBg, className)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xs font-medium", labelCls)}>{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4 shrink-0", tone === "stage" ? "text-white/40" : "text-muted-foreground/80")} aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 text-xl font-bold tabular-nums leading-none sm:text-2xl", valueCls)} style={{ fontFamily: "var(--font-heading)" }}>
        {value}
        {unit ? <span className={cn("ml-1 text-sm font-semibold", unitCls)}>{unit}</span> : null}
      </p>
    </div>
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
    <div
      className={cn(
        "grid gap-2",
        cols === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
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
    <section className={cn("rounded-3xl border border-border/80 bg-card p-4 shadow-[var(--shadow-card)]", className)}>
      {title ? (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
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
}: {
  icon?: LucideIcon
  label: string
  value: string
  delta?: string
  points?: Array<{ v: number }>
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      {Icon ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.13em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-foreground tabular-nums" style={{ fontFamily: "var(--font-heading)" }}>
          {value}
        </p>
        {delta ? <p className="mt-0.5 text-xs text-muted-foreground">{delta}</p> : null}
      </div>
      {points && points.length > 1 ? (
        <MetricTrendMini
          points={points}
          stroke="oklch(var(--primary))"
          stopColor="oklch(var(--primary))"
          className="h-12 w-[7.5rem] shrink-0"
        />
      ) : null}
    </div>
  )
}
