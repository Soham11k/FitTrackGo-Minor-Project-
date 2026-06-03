"use client"

import { motion, useReducedMotion } from "framer-motion"
import { ECG_PATH } from "@/lib/app-chrome"
import { CHROME_ACCENT } from "@/lib/chrome-accent"

interface EcgMarkProps {
  size?: number
  color?: string
  /** When true the path draws on mount and then loops a pulse opacity animation */
  animate?: boolean
}

/**
 * Animated ECG / heartbeat SVG mark.
 * Static when prefers-reduced-motion is set.
 */
export function EcgMark({ size = 20, color = CHROME_ACCENT.accent, animate = true }: EcgMarkProps) {
  const reduce = useReducedMotion() ?? false

  if (!animate || reduce) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d={ECG_PATH}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <motion.path
        d={ECG_PATH}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.5 }}
        animate={{
          pathLength: [0, 1, 1, 0.85, 1],
          opacity: [0.5, 1, 1, 0.7, 1],
        }}
        transition={{
          pathLength: { duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.55, 0.75, 1] },
          opacity:    { duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 0.55, 0.75, 1] },
        }}
      />
    </svg>
  )
}
