"use client"

import { getCoachA11yPrefs } from "@/lib/coach-a11y"

// Load voices (needed on some browsers)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}

const MOTIVATIONAL_PHRASES = [
  "Looking strong.",
  "Keep it up.",
  "Nice and controlled.",
  "Strong work.",
  "You're doing great.",
  "Stay with it, every rep counts.",
  "Breathe and keep moving.",
  "Great tempo, keep that rhythm.",
  "Posture looks good, stay tall.",
  "Power through the last few seconds.",
]

let lastSpokeAt = 0
const MIN_INTERVAL_MS = 18000
const REP_MILESTONE_INTERVAL = 5

export function speakMotivation(phrase?: string, options?: { force?: boolean }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return

  const now = Date.now()
  if (!options?.force && now - lastSpokeAt < MIN_INTERVAL_MS) return

  window.speechSynthesis.cancel()

  const text = phrase ?? MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)]!
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9
  u.pitch = 1
  u.volume = 0.7
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  if (en) u.voice = en
  window.speechSynthesis.speak(u)
  lastSpokeAt = now
}

/** Speaks only at rep milestones (1, 5, 10, 15…) so it’s not every rep. */
export function speakRepComplete(count: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  if (!getCoachA11yPrefs().announceReps) return
  const isMilestone = count === 1 || count % REP_MILESTONE_INTERVAL === 0
  if (!isMilestone) return
  const now = Date.now()
  if (now - lastSpokeAt < 4000) return

  window.speechSynthesis.cancel()
  const base = count === 1 ? "One rep done." : `${count} reps done.`
  const extra =
    count === 1
      ? "Nice start."
      : count < 10
      ? "Good pace."
      : count < 20
      ? "Strong set. Stay focused."
      : "Amazing endurance. Keep pushing."
  const text = `${base} ${extra}`
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.85
  u.pitch = 1
  u.volume = 0.65
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  if (en) u.voice = en
  window.speechSynthesis.speak(u)
  lastSpokeAt = now
}

export function speakGoodForm() {
  speakMotivation("Good form.", { force: true })
}

export function speakAdjustForm() {
  if (Date.now() - lastSpokeAt < 12000) return
  speakMotivation("Adjust your form.", { force: true })
}

/** Queue a trimmed phrase after cancelling chatter. */
export function speakAndQueue(text: string, options?: { force?: boolean }) {
  speakMotivation(text.slice(0, 380), options)
}

/** One short AI-derived cue when voice cues are enabled. */
export function speakCoachMidsetTip(text: string) {
  if (!getCoachA11yPrefs().announceReps) return
  speakAndQueue(text, { force: true })
}
