"use client"

let audioContext: AudioContext | null = null
let oscillator: OscillatorNode | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

export function playFallAlarm(): void {
  if (typeof window === "undefined") return
  stopFallAlarm()
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    audioContext = ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    oscillator = osc
    intervalId = setInterval(() => {
      if (!ctx || ctx.state === "closed") return
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = "sine"
      o.frequency.setValueAtTime(880, ctx.currentTime)
      o.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      g.gain.setValueAtTime(0.35, ctx.currentTime)
      o.connect(g)
      g.connect(ctx.destination)
      o.start(ctx.currentTime)
      o.stop(ctx.currentTime + 0.3)
    }, 600)
  } catch {
    // ignore
  }
}

export function stopFallAlarm(): void {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  try {
    if (oscillator) {
      oscillator.stop()
      oscillator.disconnect()
      oscillator = null
    }
    if (audioContext?.state !== "closed") {
      audioContext?.close()
    }
    audioContext = null
  } catch {
    // ignore
  }
}
