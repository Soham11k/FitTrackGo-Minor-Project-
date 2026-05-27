"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

interface AnimatedCounterProps {
  /** Target numeric value */
  value: number
  /** Decimal places to show (default 0) */
  decimals?: number
  /** Duration in seconds (default 0.9) */
  duration?: number
  className?: string
  /** Unit suffix displayed inline, smaller size */
  unit?: string
  unitClassName?: string
  /** Format function — default uses toFixed(decimals) */
  format?: (v: number) => string
}

/**
 * Rolls from the previous value to the new value using a spring-like tween.
 * In reduced-motion mode snaps instantly.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  duration = 0.9,
  className,
  unit,
  unitClassName,
  format,
}: AnimatedCounterProps) {
  const reduce = useReducedMotion() ?? false
  const motionValue = useMotionValue(value)
  const prevRef = useRef(value)

  const display = useTransform(motionValue, (v) => {
    if (format) return format(v)
    return v.toFixed(decimals)
  })

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      prevRef.current = value
      return
    }
    const from = prevRef.current
    prevRef.current = value
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
      from,
    })
    return () => controls.stop()
  }, [value, duration, reduce, motionValue])

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span>{display}</motion.span>
      {unit ? <span className={cn("ml-1 text-sm font-semibold", unitClassName)}>{unit}</span> : null}
    </span>
  )
}
