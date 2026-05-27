"use client"

import { useId } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import { DURATION, EASE } from "@/lib/motion"

type Props = {
  className?: string
  size?: number
  animated?: boolean
  variant?: "default" | "hero"
}

/** Pulse-glyph: heartbeat trace forming an athletic "F" — fitness-forward mark. */
const PULSE_PATH =
  "M 18 52 L 18 28 L 34 28 L 34 36 L 26 36 L 26 40 L 38 40 L 44 24 L 50 48 L 56 32 L 62 52"

export function FittrackLogoMark({
  className,
  size = 72,
  animated = false,
  variant = "default",
}: Props) {
  const uid = useId().replace(/[:]/g, "")
  const gPulse = `ftp-${uid}`
  const reduce = useReducedMotion() ?? false
  const shouldAnimate = animated && !reduce

  const strokeTransition = {
    duration: DURATION.cinematic * 0.75,
    ease: [...EASE.cinematic] as [number, number, number, number],
  }

  const Path = shouldAnimate ? motion.path : "path"

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-primary", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gPulse} x1="14" y1="54" x2="66" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--chart-2)" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <rect
        x="6"
        y="6"
        width="68"
        height="68"
        rx="18"
        className={cn(
          "stroke-border",
          variant === "hero"
            ? "fill-[color-mix(in_oklab,var(--foreground)_6%,transparent)]"
            : "fill-[color-mix(in_oklab,var(--foreground)_3%,transparent)]",
        )}
        strokeWidth="1"
      />

      <Path
        d={PULSE_PATH}
        fill="none"
        stroke={`url(#${gPulse})`}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...(shouldAnimate
          ? {
              initial: { pathLength: 0, opacity: 0.6 },
              animate: { pathLength: 1, opacity: 1 },
              transition: strokeTransition,
            }
          : {})}
      />

      {shouldAnimate ? (
        <motion.circle
          cx="62"
          cy="52"
          r="4"
          className="fill-primary"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: strokeTransition.duration * 0.85, ...strokeTransition }}
        />
      ) : (
        <circle cx="62" cy="52" r="4" className="fill-primary" />
      )}
    </svg>
  )
}

/** Static SVG for raster brand export (matches in-app mark). */
export function fittrackIconSvgMarkup(
  size: number,
  _fg = "#000000",
  accent = "#c8f135",
  accent2 = "#0ea5e9",
  bg = "#ffffff",
) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect x="6" y="6" width="68" height="68" rx="18" fill="${bg}" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
  <defs>
    <linearGradient id="g" x1="14" y1="54" x2="66" y2="22"><stop stop-color="${accent}"/><stop offset="1" stop-color="${accent2}"/></linearGradient>
  </defs>
  <path d="${PULSE_PATH}" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="62" cy="52" r="4" fill="${accent}"/>
</svg>`
}
