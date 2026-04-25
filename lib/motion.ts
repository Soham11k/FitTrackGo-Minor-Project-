/**
 * App-wide motion tokens. Use with Framer Motion; pair with `useReducedMotion` for paths
 * that must stay instant when the user enables “reduce motion.”
 *
 * **Charts (Recharts):** Animate on first mount / major tab entry only. After data refresh,
 * set `isAnimationActive={false}` (see `useChartEnterOnce`) so bars/lines do not re-tween every poll.
 */

/** Standard easing — smooth deceleration. */
export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  smooth: [0.4, 0, 0.2, 1] as const,
}

export const DURATION = {
  fast: 0.18,
  micro: 0.22,
  medium: 0.38,
  slow: 0.55,
  page: 0.42,
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

/** Recharts bar/area enter; parent should disable after first paint via `isAnimationActive`. */
export const CHART = {
  barEnterMs: 620,
  areaEnterMs: 720,
  /** After this, parent sets `isAnimationActive` false on charts. */
  enterSettleMs: 900,
} as const
