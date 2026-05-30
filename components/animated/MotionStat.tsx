"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"
import { AnimatedCounter } from "./AnimatedCounter"

interface MotionStatProps {
  label: string
  value: number
  unit?: string
  decimals?: number
  delay?: number
  labelColor?: string
  valueColor?: string
}

/**
 * Animated label + counter + optional unit, fades in on mount.
 * Drop this wherever a live/highlighted stat appears.
 */
export function MotionStat({
  label,
  value,
  unit,
  decimals = 0,
  delay = 0,
  labelColor = CHROME.muted,
  valueColor = CHROME.white,
}: MotionStatProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-black tabular-nums" style={{ color: valueColor }}>
        <AnimatedCounter value={value} decimals={decimals} />
        {unit && (
          <span className="ml-1 text-sm font-semibold" style={{ color: CHROME.muted }}>
            {unit}
          </span>
        )}
      </p>
    </motion.div>
  )
}
