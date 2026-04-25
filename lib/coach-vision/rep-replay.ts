/**
 * Rep-replay buffer — records the last N seconds of landmarks so the session
 * summary can animate the user's best / worst rep.
 *
 * Kept intentionally small: a ring of `RepFrame` (timestamps + landmarks).
 * Memory footprint ~= 33 lm * 4 floats * 30fps * 10s = ~16 KB per slot.
 */

import type { Landmark } from "@/lib/form-analysis"

export interface RepFrame {
  t: number
  landmarks: Landmark[]
}

export class RepReplayBuffer {
  private frames: RepFrame[] = []
  private readonly maxMs: number

  constructor(maxMs: number = 12_000) {
    this.maxMs = maxMs
  }

  push(landmarks: Landmark[], t: number = performance.now()) {
    this.frames.push({ t, landmarks })
    this.trim(t)
  }

  /** Freeze the last `span` ms as a standalone replay clip. */
  snapshot(span: number = 6_000): RepFrame[] {
    if (!this.frames.length) return []
    const latest = this.frames[this.frames.length - 1].t
    const cutoff = latest - span
    return this.frames.filter((f) => f.t >= cutoff).map((f) => ({ ...f, landmarks: [...f.landmarks] }))
  }

  clear() {
    this.frames = []
  }

  private trim(now: number) {
    const cutoff = now - this.maxMs
    let dropUpTo = 0
    while (dropUpTo < this.frames.length && this.frames[dropUpTo].t < cutoff) dropUpTo++
    if (dropUpTo > 0) this.frames.splice(0, dropUpTo)
  }
}
