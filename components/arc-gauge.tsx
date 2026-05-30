"use client"

import { memo, useMemo } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type ArcGaugeProps = {
  value: number
  max?: number
  size?: number
  thickness?: number
  /** Sweep angle in degrees (default 270 — leaves a gap at the bottom). */
  sweep?: number
  className?: string
  trackClassName?: string
  /** Stroke color for the progress arc. Accepts any CSS color / var. */
  progressColor?: string
  children?: React.ReactNode
}

/**
 * Semicircular / 270° arc gauge with an animated draw-in.
 * Used for the Readiness score on Home — Whoop/Fitbit style.
 */
function ArcGaugeInner({
  value,
  max = 100,
  size = 168,
  thickness = 12,
  sweep = 270,
  className,
  trackClassName,
  progressColor = "var(--primary)",
  children,
}: ArcGaugeProps) {
  const reduce = useReducedMotion() ?? false

  const { r, arcLen, dashArray, targetOffset, rotation } = useMemo(() => {
    const radius = (size - thickness) / 2
    const c = 2 * Math.PI * radius
    const sweepFrac = sweep / 360
    const arc = c * sweepFrac
    const p = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    // Gap centered at the bottom: rotate so the arc starts at the lower-left.
    const rot = 90 + (360 - sweep) / 2
    return {
      r: radius,
      arcLen: arc,
      dashArray: `${arc} ${c}`,
      targetOffset: arc * (1 - p),
      rotation: rot,
    }
  }, [size, thickness, sweep, value, max])

  const cx = size / 2
  const cy = size / 2

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: `rotate(${rotation}deg)` }}
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={cn("stroke-muted-foreground/15", trackClassName)}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={dashArray}
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={progressColor}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          initial={reduce ? { strokeDashoffset: targetOffset } : { strokeDashoffset: arcLen }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${progressColor} 45%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export const ArcGauge = memo(ArcGaugeInner)
