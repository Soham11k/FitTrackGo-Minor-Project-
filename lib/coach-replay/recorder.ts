import { drawSkeleton } from "@/lib/pose-detection"
import type { LandmarkPoint } from "@/lib/pose-detection"
import { snapshotFromLandmarks, type LandmarkSnapshot } from "./types"

function pickRecorderMime(): string {
  const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  for (const c of cands) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c
  }
  return "video/webm"
}

/** Records a VP9-ish WebM of the mirrored camera with pose overlay burned in. */
export class CoachSetRecorder {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: BlobPart[] = []
  private started = false
  private stopped = false
  private t0 = 0
  private lastSample = 0
  private frames: LandmarkSnapshot[] = []
  private repMs: number[] = []
  private stopPromise: Promise<void> | null = null
  private stopResolve: (() => void) | null = null

  isRecording(): boolean {
    return this.started && !this.stopped
  }

  start(video: HTMLVideoElement): boolean {
    if (this.started) return false
    if (typeof MediaRecorder === "undefined" || typeof document === "undefined") return false
    const vw = video.videoWidth || video.clientWidth || 640
    const vh = video.videoHeight || video.clientHeight || 480
    if (vw === 0 || vh === 0) return false

    const canvas = document.createElement("canvas")
    canvas.width = Math.max(320, vw)
    canvas.height = Math.max(240, vh)
    const ctx = canvas.getContext("2d")
    if (!ctx) return false

    this.canvas = canvas
    this.ctx = ctx
    this.chunks = []
    this.frames = []
    this.repMs = []
    this.stopped = false

    try {
      this.stream = canvas.captureStream(30)
      const mimeType = pickRecorderMime()
      this.recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 2_400_000 })
    } catch {
      this.cleanupPartial()
      return false
    }

    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    this.stopPromise = new Promise<void>((resolve) => {
      this.stopResolve = resolve
    })
    this.recorder.onstop = () => {
      this.stopResolve?.()
      this.stopResolve = null
    }

    this.recorder.start(250)
    this.t0 = performance.now()
    this.lastSample = this.t0
    this.started = true
    return true
  }

  tick(
    video: HTMLVideoElement | null | undefined,
    lm: LandmarkPoint[],
    goodForm: boolean,
    formScore: number,
    faultSegmentPairs: [number, number][] | undefined,
  ) {
    if (!this.started || this.stopped) return
    const ctx = this.ctx
    const canvas = this.canvas
    if (!ctx || !canvas || !video) return
    if (video.readyState < 2) return

    const w = canvas.width
    const h = canvas.height
    ctx.drawImage(video, 0, 0, w, h)
    if (lm.length >= 33) {
      drawSkeleton(ctx, lm, w, h, goodForm, undefined, formScore, faultSegmentPairs)
    }

    const now = performance.now()
    if (now - this.lastSample >= 1000 / 12) {
      this.lastSample = now
      this.frames.push(snapshotFromLandmarks(lm, Math.max(0, now - this.t0)))
    }
  }

  markRepBoundary() {
    if (!this.started || this.stopped) return
    this.repMs.push(Math.max(0, performance.now() - this.t0))
  }

  async stop(): Promise<{ blob: Blob; durationMs: number; landmarkFrames: LandmarkSnapshot[]; repMarkersMs: number[] } | null> {
    if (!this.started || this.stopped) return null
    this.stopped = true
    const durationMs = Math.max(0, performance.now() - this.t0)
    const rec = this.recorder

    try {
      if (rec && rec.state !== "inactive") rec.stop()
    } catch {
      /* noop */
    }

    await this.stopPromise

    const mime =
      rec && "mimeType" in rec && typeof (rec as { mimeType?: string }).mimeType === "string"
        ? (rec as { mimeType: string }).mimeType
        : "video/webm"
    const blob = new Blob(this.chunks, { type: mime.includes("webm") ? mime : "video/webm" })
    const landmarkFrames = this.frames
    const repMarkersMs = this.repMs
    this.cleanupAfterStop()
    if (blob.size < 64) return null
    return { blob, durationMs, landmarkFrames, repMarkersMs }
  }

  private cleanupPartial() {
    this.canvas = null
    this.ctx = null
    this.stream = null
    this.recorder = null
    this.started = false
  }

  private cleanupAfterStop() {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.canvas = null
    this.ctx = null
    this.stream = null
    this.recorder = null
    this.started = false
  }
}
