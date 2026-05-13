const KEY = "fittrackgo_coach_midset_tips_v1"

/** Real-time-ish LLM cues during a set — default off for cost/noise control. */
export function isCoachMidsetTipsEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function setCoachMidsetTipsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0")
  } catch { /* noop */ }
}
