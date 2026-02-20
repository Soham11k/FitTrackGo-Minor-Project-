"use client"

// Load voices (needed on some browsers)
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}

const MOTIVATIONAL_PHRASES = [
  "You've got this!",
  "Looking strong!",
  "Keep it up!",
  "Nice rep!",
  "That's the way!",
  "Stay focused!",
  "One more!",
  "Great form!",
  "You're doing great!",
  "Keep pushing!",
  "Almost there!",
  "Strong work!",
  "Nice and controlled!",
  "Perfect!",
  "Get it!",
]

let lastSpokeAt = 0
const MIN_INTERVAL_MS = 8000
const REP_SPEAK_DEBOUNCE_MS = 3000

export function speakMotivation(phrase?: string, options?: { force?: boolean; forRep?: boolean }) {
  if (typeof window === "undefined" || !window.speechSynthesis) return

  const now = Date.now()
  if (!options?.force && !options?.forRep) {
    if (now - lastSpokeAt < MIN_INTERVAL_MS) return
  }
  if (options?.forRep && now - lastSpokeAt < REP_SPEAK_DEBOUNCE_MS) return

  window.speechSynthesis.cancel()

  const text = phrase ?? MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)]!
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.95
  u.pitch = 1
  u.volume = 1
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  if (en) u.voice = en
  window.speechSynthesis.speak(u)
  lastSpokeAt = now
}

export function speakRepComplete(count: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(count === 1 ? "One rep! Nice!" : `${count} reps! Keep going!`)
  u.rate = 0.9
  u.pitch = 1
  u.volume = 1
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  if (en) u.voice = en
  window.speechSynthesis.speak(u)
  lastSpokeAt = Date.now()
}

export function speakGoodForm() {
  speakMotivation("Good form!", { force: true })
}

export function speakAdjustForm() {
  if (Date.now() - lastSpokeAt < 5000) return
  speakMotivation("Adjust your form. You've got this!", { force: true })
}
