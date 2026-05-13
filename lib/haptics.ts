/** Centralized haptics; no-ops when unsupported or user prefers reduced motion. */

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

const patterns = {
  tick: [8] as number | number[],
  success: [12, 40, 12] as number | number[],
  celebrate: [20, 50, 20, 50, 30] as number | number[],
  split: [10, 30, 10] as number | number[],
  fault: [6, 20, 6, 20, 12] as number | number[],
} as const

export type HapticPulse = keyof typeof patterns

export function pulse(kind: HapticPulse): void {
  if (prefersReducedMotion()) return
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(patterns[kind])
    }
  } catch {
    /* ignore */
  }
}
