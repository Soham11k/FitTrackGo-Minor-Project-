"use client"

import { useEffect, useRef } from "react"
import { motion, useReducedMotion, animate } from "framer-motion"
import { cn } from "@/lib/utils"

interface PulseHeartProps {
  /** Beats per minute — controls animation timing */
  bpm?: number | null
  className?: string
  size?: number
  color?: string
}

/**
 * Animated ECG/heartbeat-line SVG that breathes at the given BPM rate.
 * Falls back to a static heart icon in reduced-motion mode.
 */
export function PulseHeart({ bpm = 72, className, size = 48, color = "var(--metric-hr)" }: PulseHeartProps) {
  const reduce = useReducedMotion() ?? false
  const pathRef = useRef<SVGPathElement>(null)
  const beatRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const effectiveBpm = bpm ?? 72
  const intervalMs = Math.max(400, (60 / effectiveBpm) * 1000)

  useEffect(() => {
    if (reduce || !pathRef.current) return

    const triggerBeat = () => {
      if (!pathRef.current) return
      animate(pathRef.current, { scaleY: [1, 1.25, 0.9, 1] }, {
        duration: 0.35,
        ease: "easeInOut",
        times: [0, 0.25, 0.6, 1],
      })
      beatRef.current = setTimeout(triggerBeat, intervalMs)
    }

    beatRef.current = setTimeout(triggerBeat, 300)
    return () => {
      if (beatRef.current) clearTimeout(beatRef.current)
    }
  }, [intervalMs, reduce])

  // ECG-like heartbeat line path
  const w = size
  const h = size
  const mid = h / 2
  const ecgPath = `M0,${mid} L${w * 0.2},${mid} L${w * 0.28},${mid - h * 0.3} L${w * 0.35},${mid + h * 0.25} L${w * 0.42},${mid - h * 0.38} L${w * 0.5},${mid} L${w * 0.8},${mid}`

  if (reduce) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} className={cn("shrink-0", className)} aria-hidden>
        <path d={ecgPath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w * 0.8} cy={mid} r={3} fill={color} />
      </svg>
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} className={cn("shrink-0", className)} aria-hidden>
      <motion.path
        ref={pathRef}
        d={ecgPath}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ originX: "50%", originY: "50%" }}
      />
      <motion.circle
        cx={w * 0.8}
        cy={mid}
        r={3}
        fill={color}
        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 60 / effectiveBpm, ease: "easeInOut" }}
      />
    </svg>
  )
}
