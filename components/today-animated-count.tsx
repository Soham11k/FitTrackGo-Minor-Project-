"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

/**
 * Count-up animation for a whole number; respects prefers-reduced-motion.
 */
export function TodayAnimatedCount({
  value,
  className,
  durationMs = 720,
}: {
  value: number
  className?: string
  durationMs?: number
}) {
  const reduceMotion = useReducedMotion()
  const lastRef = useRef(0)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (reduceMotion === true) {
      setDisplay(value)
      lastRef.current = value
      return
    }
    const from = lastRef.current
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const ease = 1 - (1 - t) ** 3
      const v = Math.round(from + (value - from) * ease)
      setDisplay(v)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        lastRef.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduceMotion, durationMs])

  return <span className={cn("tabular-nums", className)}>{display}</span>
}
