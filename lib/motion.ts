/**
 * App-wide motion tokens. Use with Framer Motion; pair with `useReducedMotion` for paths
 * that must stay instant when the user enables “reduce motion.”
 *
 * **Charts (Recharts):** Animate on first mount / major tab entry only. After data refresh,
 * set `isAnimationActive={false}` (see `useChartEnterOnce`) so bars/lines do not re-tween every poll.
 */

import type { Variants } from "framer-motion"

/** Standard easing — smooth deceleration. */
export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
  /** Slower deceleration for route-draw and hero beats. */
  cinematic: [0.16, 1, 0.3, 1] as const,
}

export const DURATION = {
  fast: 0.18,
  micro: 0.22,
  medium: 0.38,
  slow: 0.55,
  page: 0.42,
  /** Hero route trace, stat staggers after draw. */
  cinematic: 1.2,
  celebration: 0.7,
}

export const SPRING = {
  expressive: { type: "spring" as const, stiffness: 380, damping: 22 },
  card: { type: "spring" as const, stiffness: 320, damping: 24 },
  celebrate: { type: "spring" as const, stiffness: 380, damping: 18 },
  soft: { type: "spring" as const, stiffness: 280, damping: 28 },
  list: { type: "spring" as const, stiffness: 400, damping: 26 },
}

/**
 * @param cap — max items that receive increasing delay (avoids long lists animating for seconds).
 */
export function staggerDelaySec(index: number, cap = 12, base = 0.05) {
  return Math.min(index, cap - 1) * base
}

/** Parent Variants that stagger visible children (`delayChildren` + `staggerChildren`). `cap` limits long lists. */
export function staggerChildren(
  delayChildren = 0,
  staggerEach = 0.06,
): Variants {
  return {
    hidden: {},
    show: {
      transition: {
        delayChildren,
        staggerChildren: staggerEach,
        when: "beforeChildren",
      },
    },
  }
}

/** Stagger duration for child `variant` transitions (optional manual use with capped index). */
export function staggerDelayForIndex(index: number, cap = 12, staggerEach = 0.06) {
  return Math.min(index, cap - 1) * staggerEach
}

/** Named cinematic presets for `motion.div` `variants`. */
export const CINEMATIC = {
  heroEnter: {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.medium, ease: [...EASE.out] },
    },
  } satisfies Variants,
  statReveal: {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: DURATION.micro, ease: [...EASE.out] },
    },
  } satisfies Variants,
  celebrationBurst: {
    hidden: { scale: 0.82, opacity: 0 },
    show: {
      scale: 1,
      opacity: 1,
      transition: SPRING.celebrate,
    },
  } satisfies Variants,
} as const

/** Bottom-nav tab content enter / exit (no transform on parent — safe for portaled overlays). */
export const TAB_PAGE = {
  enter: {
    opacity: 0,
    y: 10,
    filter: "blur(4px)",
  },
  center: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: DURATION.page, ease: [...EASE.cinematic] },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(2px)",
    transition: { duration: DURATION.fast, ease: [...EASE.smooth] },
  },
} as const satisfies Variants

/** Logo hero intro (splash / login). */
export const LOGO_INTRO = {
  hidden: { opacity: 0, scale: 0.82, filter: "blur(8px)" },
  show: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: DURATION.slow, ease: [...EASE.cinematic] },
  },
} as const satisfies Variants

/** Staggered list / card children inside a tab. */
export const LIST_ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.medium, ease: [...EASE.out] },
  },
} as const satisfies Variants

/** Recharts bar/area enter; parent should disable after first paint via `isAnimationActive`. */
export const CHART = {
  barEnterMs: 620,
  areaEnterMs: 720,
  /** After this, parent sets `isAnimationActive` false on charts. */
  enterSettleMs: 900,
} as const

/**
 * CHROME-specific motion presets for the orange/black design system.
 * All respect prefers-reduced-motion when consumed with `useReducedMotion`.
 */
export const CHROME_MOTION = {
  /** Card fade+slide up on mount — use as `initial`/`animate` directly */
  cardEnter: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
  /** Hero tab headline */
  tabHero: {
    hidden: { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
    },
  } satisfies Variants,
  /** SVG path draw-in for hero accent lines */
  heroDraw: {
    hidden: { pathLength: 0, opacity: 0.3 },
    show: {
      pathLength: 1,
      opacity: 1,
      transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] as const },
    },
  } satisfies Variants,
  /** Shimmer: apply to backgroundPosition via `animate` on a styled div */
  shimmerTransition: { duration: 2.2, repeat: Infinity, ease: "linear" as const, repeatDelay: 0.8 },
} as const
