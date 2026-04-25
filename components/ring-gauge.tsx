"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

type RingGaugeProps = {
  value: number
  max: number
  size?: number
  /** Stroke thickness in px. Alias: `thickness`. */
  stroke?: number
  thickness?: number
  className?: string
  trackClassName?: string
  progressClassName?: string
  /** When true, use a spring-style settle (respects prefers-reduced-motion). */
  spring?: boolean
  children?: React.ReactNode
}

/** SVG progress ring — animates stroke-dashoffset (GPU-friendly). */
function RingGaugeInner({
  value,
  max,
  size = 92,
  stroke,
  thickness,
  className,
  trackClassName,
  progressClassName,
  spring = false,
  children,
}: RingGaugeProps) {
  const strokeWidth = thickness ?? stroke ?? 7
  const reduceMotion = useReducedMotion() ?? false

  const { r, c, targetOffset } = useMemo(() => {
    const radius = (size - strokeWidth) / 2
    const circ = 2 * Math.PI * radius
    const p = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
    return { r: radius, c: circ, targetOffset: circ * (1 - p) }
  }, [value, max, size, strokeWidth])

  // Manual spring so we don't need to pull in `motion()` SVG — keeps bundle small.
  const [animatedOffset, setAnimatedOffset] = useState(targetOffset)
  const rafRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const currentRef = useRef(targetOffset)

  useEffect(() => {
    if (!spring || reduceMotion) {
      currentRef.current = targetOffset
      setAnimatedOffset(targetOffset)
      return
    }
    const stiffness = 140
    const damping = 18
    const mass = 1
    const dt = 1 / 60
    let last = performance.now()

    const step = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000)
      last = now
      const iter = Math.max(1, Math.round(delta / dt))
      for (let i = 0; i < iter; i++) {
        const displacement = currentRef.current - targetOffset
        const springForce = -stiffness * displacement
        const dampingForce = -damping * velocityRef.current
        const accel = (springForce + dampingForce) / mass
        velocityRef.current += accel * dt
        currentRef.current += velocityRef.current * dt
      }
      const done =
        Math.abs(currentRef.current - targetOffset) < 0.1 &&
        Math.abs(velocityRef.current) < 0.1
      if (done) {
        currentRef.current = targetOffset
        velocityRef.current = 0
        setAnimatedOffset(targetOffset)
        rafRef.current = null
        return
      }
      setAnimatedOffset(currentRef.current)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [targetOffset, spring, reduceMotion])

  const cx = size / 2
  const cy = size / 2
  const renderedOffset = spring && !reduceMotion ? animatedOffset : targetOffset

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={cn("stroke-muted-foreground/15", trackClassName)}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={cn(
            !spring &&
              "transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            "stroke-primary",
            progressClassName
          )}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={renderedOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1 text-center">{children}</div>
    </div>
  )
}

export const RingGauge = memo(RingGaugeInner)
