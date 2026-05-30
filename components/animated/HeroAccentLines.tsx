"use client"

import { motion, useReducedMotion } from "framer-motion"
import { CHROME } from "@/lib/app-chrome"

const DEFAULT_PATHS = [
  "M -20 80  C 60 50, 140 110, 220 70  S 360 40, 500 80",
  "M -20 120 C 60 90, 130 150, 240 110 S 380 75, 500 120",
  "M -20 160 C 80 135, 150 185, 260 148 S 400 115, 500 155",
]

interface HeroAccentLinesProps {
  paths?: string[]
  width?: number
  height?: number
  strokeColor?: string
  className?: string
}

/**
 * Animated SVG contour paths for dark hero sections.
 * Paths draw in sequentially on mount, then pulse opacity.
 */
export function HeroAccentLines({
  paths = DEFAULT_PATHS,
  width = 480,
  height = 200,
  strokeColor = CHROME.border,
  className = "",
}: HeroAccentLinesProps) {
  const reduce = useReducedMotion() ?? false

  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          initial={reduce ? { pathLength: 1, opacity: 0.3 } : { pathLength: 0, opacity: 0.2 }}
          animate={{
            pathLength: 1,
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={
            reduce
              ? {}
              : {
                  pathLength: { duration: 1.4, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] },
                  opacity: { duration: 3.5, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" },
                }
          }
        />
      ))}
    </svg>
  )
}
