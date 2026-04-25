/**
 * Accessibility preferences for AI Coach (local only).
 */

const KEY = "fittrackgo_coach_a11y_v1"

export interface CoachA11yPrefs {
  hapticOnRep: boolean
  announceReps: boolean
  reduceMotion: boolean
  highContrastVideo: boolean
}

const DEFAULTS: CoachA11yPrefs = {
  hapticOnRep: true,
  announceReps: true,
  reduceMotion: false,
  highContrastVideo: false,
}

export function getCoachA11yPrefs(): CoachA11yPrefs {
  if (typeof window === "undefined") return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const reduceMotion =
        typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      return { ...DEFAULTS, reduceMotion }
    }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setCoachA11yPrefs(patch: Partial<CoachA11yPrefs>) {
  const next = { ...getCoachA11yPrefs(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* quota */ }
}

export function hapticRepPulse() {
  const p = getCoachA11yPrefs()
  if (!p.hapticOnRep || typeof navigator === "undefined" || !navigator.vibrate) return
  try {
    navigator.vibrate(18)
  } catch { /* noop */ }
}
