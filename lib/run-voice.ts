const KEY = "ft-run-voice"

export function setRunVoiceEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0")
  } catch {
    /* noop */
  }
}

export function isRunVoiceEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

/** Optional km-split cue (respects toggle). */
export function announceRunKmSplit(lap: number, pacePerKm: string): void {
  if (typeof window === "undefined" || !isRunVoiceEnabled()) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(`Kilometer ${lap}. Pace ${pacePerKm} per kilometer.`)
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  } catch {
    /* noop */
  }
}
