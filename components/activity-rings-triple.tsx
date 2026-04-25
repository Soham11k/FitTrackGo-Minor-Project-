"use client"

import { memo, useMemo } from "react"
import { cn } from "@/lib/utils"

export type ActivityRingLayer = {
  value: number
  max: number
  label: string
  /** Tailwind classes for progress stroke (e.g. stroke-primary). */
  progressClassName: string
}

type ActivityRingsTripleProps = {
  outer: ActivityRingLayer
  middle: ActivityRingLayer
  inner: ActivityRingLayer
  /** Total SVG size (square). */
  size?: number
  className?: string
}

/**
 * Three concentric progress rings (Fitbit / Apple Watch style).
 * Stroke-dashoffset animates via CSS (GPU-friendly), matching RingGauge feel.
 */
function ActivityRingsTripleInner({
  outer,
  middle,
  inner,
  size = 120,
  className,
}: ActivityRingsTripleProps) {
  const strokeW = 5
  const layers = useMemo(() => {
    const cx = size / 2
    const pad = strokeW / 2 + 2
    const rOuter = Math.max(pad + 6, size * 0.42)
    const rMid = rOuter - (strokeW + 4)
    const rInner = rMid - (strokeW + 4)
    const spec: Array<{
      r: number
      circ: number
      targetOffset: number
      progressClassName: string
      id: string
    }> = [
      {
        id: "outer",
        r: rOuter,
        circ: 2 * Math.PI * rOuter,
        targetOffset:
          2 *
          Math.PI *
          rOuter *
          (1 - (outer.max > 0 ? Math.min(1, Math.max(0, outer.value / outer.max)) : 0)),
        progressClassName: outer.progressClassName,
      },
      {
        id: "middle",
        r: rMid,
        circ: 2 * Math.PI * rMid,
        targetOffset:
          2 *
          Math.PI *
          rMid *
          (1 - (middle.max > 0 ? Math.min(1, Math.max(0, middle.value / middle.max)) : 0)),
        progressClassName: middle.progressClassName,
      },
      {
        id: "inner",
        r: rInner,
        circ: 2 * Math.PI * rInner,
        targetOffset:
          2 *
          Math.PI *
          rInner *
          (1 - (inner.max > 0 ? Math.min(1, Math.max(0, inner.value / inner.max)) : 0)),
        progressClassName: inner.progressClassName,
      },
    ]
    return { spec, cx }
  }, [size, outer, middle, inner, strokeW])

  const { spec, cx } = layers

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width: size, minWidth: size }}
      role="img"
      aria-label={`${outer.label} ${outer.value} of ${outer.max}, ${middle.label} ${middle.value} of ${middle.max}, ${inner.label} ${inner.value} of ${inner.max}`}
    >
      <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
        {spec.map((L) => (
          <circle
            key={`t-${L.id}`}
            cx={cx}
            cy={cx}
            r={L.r}
            fill="none"
            className="stroke-muted-foreground/15"
            strokeWidth={strokeW}
          />
        ))}
        {spec.map((L) => (
          <circle
            key={`p-${L.id}`}
            cx={cx}
            cy={cx}
            r={L.r}
            fill="none"
            className={cn(
              "transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              L.progressClassName
            )}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={L.circ}
            strokeDashoffset={L.targetOffset}
          />
        ))}
      </svg>
      <div className="mt-1.5 flex w-full max-w-[10.5rem] justify-between gap-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:text-[8px]">
        <span className="min-w-0 flex-1 truncate text-center text-primary">{outer.label}</span>
        <span className="min-w-0 flex-1 truncate text-center text-chart-2">{middle.label}</span>
        <span className="min-w-0 flex-1 truncate text-center text-metric-streak">{inner.label}</span>
      </div>
    </div>
  )
}

export const ActivityRingsTriple = memo(ActivityRingsTripleInner)
