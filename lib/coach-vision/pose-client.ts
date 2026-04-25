/**
 * Main-thread wrapper around the pose-worker. Provides:
 *  - lifecycle (create/close)
 *  - ImageBitmap grabbing from a source HTMLVideoElement
 *  - adaptive FPS (drops frames when main thread is slow or tab is hidden)
 *  - a tiny pub-sub for landmark frames
 */

import type { Landmark } from "@/lib/form-analysis"

export interface PoseFrame {
  frameId: number
  timestamp: number
  landmarks: Landmark[]
  worldLandmarks: Landmark[]
}

export interface PoseClientOptions {
  /** Model URL (default: Pose landmarker lite). */
  modelUrl?: string
  /** Max target fps. Lower on low-power devices. */
  maxFps?: number
  /** Minimum fps. When the worker stalls we drop here rather than below. */
  minFps?: number
}

const DEFAULT_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"

export class PoseClient {
  private worker: Worker | null = null
  private ready = false
  private sourceVideo: HTMLVideoElement | null = null
  private listeners = new Set<(f: PoseFrame) => void>()
  private running = false
  private currentFps: number
  private readonly maxFps: number
  private readonly minFps: number
  private frameId = 0
  private lastFrameSentAt = 0
  private inflight = 0
  private stallCount = 0
  private rafHandle: number | null = null

  constructor(opts: PoseClientOptions = {}) {
    this.maxFps = opts.maxFps ?? 30
    this.minFps = opts.minFps ?? 8
    this.currentFps = this.maxFps
  }

  async init(modelUrl: string = DEFAULT_MODEL): Promise<void> {
    if (this.worker) return
    this.worker = new Worker(
      new URL("./pose-worker.ts", import.meta.url),
      { type: "module" }
    )

    await new Promise<void>((resolve, reject) => {
      if (!this.worker) return reject(new Error("no worker"))
      const onMsg = (ev: MessageEvent) => {
        const m = ev.data
        if (m.type === "ready") {
          this.ready = true
          this.worker?.removeEventListener("message", onMsg)
          resolve()
        } else if (m.type === "error") {
          reject(new Error(m.message))
        }
      }
      this.worker.addEventListener("message", onMsg)
      this.worker.addEventListener("error", (e) => reject(e.error ?? new Error(e.message)))
      this.worker.postMessage({ type: "init", modelUrl })
    })

    this.worker.addEventListener("message", (ev: MessageEvent) => {
      const m = ev.data
      if (m.type === "landmarks") {
        this.inflight = Math.max(0, this.inflight - 1)
        const frame: PoseFrame = {
          frameId: m.frameId,
          timestamp: m.timestamp,
          landmarks: (m.landmarks?.[0] ?? []) as Landmark[],
          worldLandmarks: (m.worldLandmarks?.[0] ?? []) as Landmark[],
        }
        for (const cb of this.listeners) {
          try {
            cb(frame)
          } catch (err) {
            console.warn("[pose-client] listener threw:", err)
          }
        }
      }
    })
  }

  start(video: HTMLVideoElement) {
    if (!this.ready) throw new Error("pose-client not initialized")
    this.sourceVideo = video
    this.running = true
    this.scheduleNextFrame()
  }

  stop() {
    this.running = false
    if (this.rafHandle != null) cancelAnimationFrame(this.rafHandle)
    this.rafHandle = null
  }

  dispose() {
    this.stop()
    this.listeners.clear()
    this.worker?.postMessage({ type: "close" })
    this.worker?.terminate()
    this.worker = null
    this.ready = false
  }

  onFrame(cb: (f: PoseFrame) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private scheduleNextFrame = () => {
    if (!this.running) return
    this.rafHandle = requestAnimationFrame(() => this.tick())
  }

  private async tick() {
    if (!this.running || !this.sourceVideo || !this.worker) return

    // Adaptive throttling.
    const now = performance.now()
    const minInterval = 1000 / this.currentFps
    if (now - this.lastFrameSentAt < minInterval) {
      this.scheduleNextFrame()
      return
    }

    // If the worker is backed up, drop this frame and nudge fps down.
    if (this.inflight >= 2) {
      this.stallCount++
      if (this.stallCount > 15) {
        this.currentFps = Math.max(this.minFps, Math.floor(this.currentFps * 0.75))
        this.stallCount = 0
      }
      this.scheduleNextFrame()
      return
    }
    if (this.stallCount > 0) this.stallCount--

    try {
      const bitmap = await createImageBitmap(this.sourceVideo)
      this.inflight++
      const frameId = ++this.frameId
      const timestamp = now
      this.lastFrameSentAt = now
      this.worker.postMessage(
        { type: "frame", bitmap, timestamp, frameId },
        [bitmap]
      )

      // If we've been running comfortably, try to raise fps back up.
      if (this.currentFps < this.maxFps && this.inflight <= 1) {
        this.currentFps = Math.min(this.maxFps, this.currentFps + 1)
      }
    } catch (err) {
      console.warn("[pose-client] createImageBitmap failed:", err)
    } finally {
      this.scheduleNextFrame()
    }
  }
}
