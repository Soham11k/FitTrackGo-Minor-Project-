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

/** Activity rings + proof bead — simplified for crisp small-size legibility. */
const RINGS = {
  outer: "M 40 12 A 28 28 0 1 1 18 56",
  mid: "M 40 20 A 20 20 0 1 1 26 54",
  inner: "M 40 28 A 12 12 0 1 1 34 50",
} as const

export function FittrackLogoMark({
  className,
  size = 72,
  animated = false,
  variant = "default",
}: Props) {
  const uid = useId().replace(/[:]/g, "")
  const gAccent = `ftg-${uid}-accent`
  const reduce = useReducedMotion() ?? false
  const shouldAnimate = animated && !reduce

  const ringTransition = {
    duration: DURATION.cinematic * 0.85,
    ease: [...EASE.cinematic] as [number, number, number, number],
  }

  const Ring = shouldAnimate ? motion.path : "path"
  const Bead = shouldAnimate ? motion.circle : "circle"

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
        <linearGradient id={gAccent} x1="16" y1="58" x2="64" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--chart-2)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <rect
        x="6"
        y="6"
        width="68"
        height="68"
        rx="18"
        className={cn(
          "stroke-[color-mix(in_oklab,var(--foreground)_12%,transparent)]",
          variant === "hero"
            ? "fill-[color-mix(in_oklab,var(--foreground)_8%,transparent)]"
            : "fill-[color-mix(in_oklab,var(--foreground)_4%,transparent)]",
        )}
        strokeWidth="1"
      />

      <Ring
        d={RINGS.inner}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity={0.12}
        strokeWidth="2"
        strokeLinecap="round"
        {...(shouldAnimate
          ? {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: { ...ringTransition, delay: 0.18 },
            }
          : {})}
      />
      <Ring
        d={RINGS.mid}
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity={0.18}
        strokeWidth="2.5"
        strokeLinecap="round"
        {...(shouldAnimate
          ? {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: { ...ringTransition, delay: 0.1 },
            }
          : {})}
      />
      <Ring
        d={RINGS.outer}
        fill="none"
        stroke={`url(#${gAccent})`}
        strokeWidth="4.5"
        strokeLinecap="round"
        {...(shouldAnimate
          ? {
              initial: { pathLength: 0 },
              animate: { pathLength: 1 },
              transition: ringTransition,
            }
          : {})}
      />

      <Bead
        cx="18"
        cy="56"
        r="4.5"
        fill="var(--primary)"
        {...(shouldAnimate
          ? {
              initial: { scale: 0, opacity: 0 },
              animate: { scale: 1, opacity: 1 },
              transition: { delay: ringTransition.duration * 0.75, ...ringTransition },
            }
          : {})}
      />
    </svg>
  )
}

/** Static SVG for raster brand export (matches in-app mark). */
export function fittrackIconSvgMarkup(
  size: number,
  fg = "#fafafa",
  accent = "#22c55e",
  accent2 = "#0ea5e9",
  bg = "#121212",
) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect x="6" y="6" width="68" height="68" rx="18" fill="${bg}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <defs>
    <linearGradient id="g" x1="16" y1="58" x2="64" y2="16"><stop stop-color="${accent}"/><stop offset="1" stop-color="${accent2}"/></linearGradient>
  </defs>
  <path d="M 40 28 A 12 12 0 1 1 34 50" fill="none" stroke="${fg}" stroke-opacity="0.12" stroke-width="2" stroke-linecap="round"/>
  <path d="M 40 20 A 20 20 0 1 1 26 54" fill="none" stroke="${fg}" stroke-opacity="0.18" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M 40 12 A 28 28 0 1 1 18 56" fill="none" stroke="url(#g)" stroke-width="4.5" stroke-linecap="round"/>
  <circle cx="18" cy="56" r="4.5" fill="${accent}"/>
</svg>`
}
