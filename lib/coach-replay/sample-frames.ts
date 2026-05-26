/**
 * Client-side frame sampler. Decodes a WebM blob in a hidden <video>,
 * seeks to evenly-spaced timestamps, and snapshots each frame to a
 * downscaled JPEG data URL.
 */

import type { ClipReviewFrame } from "@/lib/ai-coach/clip-review"

const MIN_FRAMES = 2

export type SampleFramesOptions = {
  count?: number
  maxSide?: number
  quality?: number
  /** Minimum successful frames before returning (default 2). */
  minFrames?: number
}

export type SampleFramesPerRepOptions = SampleFramesOptions & {
  framesPerRep?: number
  maxTotal?: number
}

export async function sampleFramesFromBlob(
  blob: Blob,
  opts: SampleFramesOptions = {}
): Promise<ClipReviewFrame[]> {
  const maxCount = Math.max(MIN_FRAMES, Math.min(24, opts.count ?? 12))
  const maxSide = opts.maxSide ?? 512
  const quality = opts.quality ?? 0.72
  const minFrames = Math.max(1, opts.minFrames ?? MIN_FRAMES)

  const url = URL.createObjectURL(blob)
  const video = document.createElement("video")
  video.preload = "auto"
  video.muted = true
  video.playsInline = true
  video.setAttribute("playsinline", "true")
  video.src = url

  try {
    await waitForVideoReady(video)
    const duration =
      isFinite(video.duration) && video.duration > 0 ? video.duration : 0

    if (duration <= 0) {
      const single = await captureFrame(video, 0, maxSide, quality)
      if (!single) return []
      // Many WebM blobs report duration NaN/0 until fully buffered; callers still need ≥2 JPEGs for the review API.
      return [single, { ...single, timestampMs: single.timestampMs + 33 }]
    }

    // Short clips: fewer seeks (more reliable); longer clips: more samples.
    const targetCount = Math.min(
      maxCount,
      Math.max(minFrames, Math.ceil(duration * 3) + 1)
    )

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return []

    const seen = new Set<number>()
    const frames: ClipReviewFrame[] = []

    const addFrame = (frame: ClipReviewFrame | null) => {
      if (!frame) return
      // Unique ms key: burst snapshots at currentTime===0 shared the same timestamp and
      // were dropped, leaving only one JPEG for APIs that require ≥2 frames.
      let key = frame.timestampMs
      while (seen.has(key)) key += 1
      seen.add(key)
      frames.push(key === frame.timestampMs ? frame : { ...frame, timestampMs: key })
    }

    // Prime decoder — helps WebM from MediaRecorder expose valid frames.
    try {
      video.currentTime = 0
      await seekVideo(video, 0, 2500)
      await captureFrame(video, 0, maxSide, quality).then(addFrame)
    } catch {
      /* continue */
    }

    const times: number[] = []
    for (let i = 0; i < targetCount; i++) {
      const frac = targetCount === 1 ? 0.5 : (i + 0.5) / targetCount
      times.push(Math.min(duration * 0.98, Math.max(0, duration * frac)))
    }
    // Always include near-end frame for short sets.
    if (duration > 0.15) {
      times.push(Math.max(0, duration - 0.05))
    }

    const uniqueTimes = [...new Set(times.map((t) => Math.round(t * 1000) / 1000))].sort(
      (a, b) => a - b
    )

    for (const t of uniqueTimes) {
      if (frames.length >= maxCount) break
      try {
        await seekVideo(video, t, 2500)
      } catch {
        /* still try to draw whatever frame is decoded */
      }
      addFrame(await captureFrame(video, t, maxSide, quality))
    }

    if (frames.length < minFrames) {
      // Last resort: burst captures at start without further seeks.
      for (let i = 0; i < 4 && frames.length < minFrames; i++) {
        video.currentTime = 0
        await delay(80)
        addFrame(await captureFrame(video, 0, maxSide, quality))
      }
    }

    return frames.sort((a, b) => a.timestampMs - b.timestampMs)
  } finally {
    try {
      video.pause()
      video.removeAttribute("src")
      video.load()
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(url)
  }
}

/**
 * Sample stills near each rep marker (tagged with repIndex). Falls back to
 * chronological sampling when markers are missing or too sparse.
 */
export async function sampleFramesPerRep(
  blob: Blob,
  repMarkersMs: number[],
  durationMs: number,
  opts: SampleFramesPerRepOptions = {},
): Promise<ClipReviewFrame[]> {
  const markers = repMarkersMs.filter((m) => typeof m === "number" && m >= 0)
  if (markers.length < 1) {
    return sampleFramesFromBlob(blob, opts)
  }

  const framesPerRep = Math.max(1, Math.min(3, opts.framesPerRep ?? 2))
  const maxTotal = Math.max(2, Math.min(24, opts.maxTotal ?? 14))
  const maxSide = opts.maxSide ?? 512
  const quality = opts.quality ?? 0.72

  const url = URL.createObjectURL(blob)
  const video = document.createElement("video")
  video.preload = "auto"
  video.muted = true
  video.playsInline = true
  video.setAttribute("playsinline", "true")
  video.src = url

  try {
    await waitForVideoReady(video)
    const durationSec =
      isFinite(video.duration) && video.duration > 0
        ? video.duration
        : Math.max(0.1, durationMs / 1000)

    const seen = new Set<string>()
    const frames: ClipReviewFrame[] = []

    const addFrame = (frame: ClipReviewFrame | null) => {
      if (!frame || frames.length >= maxTotal) return
      const key = `${frame.repIndex ?? "x"}:${frame.timestampMs}`
      if (seen.has(key)) return
      seen.add(key)
      frames.push(frame)
    }

    for (let repIndex = 0; repIndex < markers.length && frames.length < maxTotal; repIndex++) {
      const centerMs = markers[repIndex]!
      const prevMs = repIndex > 0 ? markers[repIndex - 1]! : 0
      const midMs = Math.round((prevMs + centerMs) / 2)
      const seekTimes = [
        Math.max(0, centerMs - 300),
        midMs > 0 && midMs < centerMs ? midMs : centerMs,
        centerMs,
      ]
        .slice(0, framesPerRep)
        .map((ms) => Math.min(durationSec * 1000 * 0.98, Math.max(0, ms)) / 1000)

      const uniqueSec = [...new Set(seekTimes.map((t) => Math.round(t * 1000) / 1000))]
      for (const t of uniqueSec) {
        if (frames.length >= maxTotal) break
        try {
          await seekVideo(video, t, 2500)
        } catch {
          /* continue */
        }
        const captured = await captureFrame(video, t, maxSide, quality)
        if (captured) addFrame({ ...captured, repIndex })
      }
    }

    if (frames.length < 2) {
      const fallback = await sampleFramesFromBlob(blob, { ...opts, count: maxTotal, minFrames: 2 })
      return fallback.length >= 2 ? fallback : frames
    }

    return frames.sort((a, b) => (a.repIndex ?? 99) - (b.repIndex ?? 99) || a.timestampMs - b.timestampMs)
  } finally {
    try {
      video.pause()
      video.removeAttribute("src")
      video.load()
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(url)
  }
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && isFinite(video.duration) && video.duration > 0) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      if (video.readyState >= 1) resolve()
      else reject(new Error("video_load_timeout"))
    }, 12_000)
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("video_decode_error"))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener("loadeddata", onReady)
      video.removeEventListener("loadedmetadata", onReady)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("loadeddata", onReady, { once: true })
    video.addEventListener("loadedmetadata", onReady, { once: true })
    video.addEventListener("error", onError, { once: true })
    try {
      void video.play().then(() => video.pause()).catch(() => {})
    } catch {
      /* ignore */
    }
  })
}

async function captureFrame(
  video: HTMLVideoElement,
  t: number,
  maxSide: number,
  quality: number
): Promise<ClipReviewFrame | null> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const scale = Math.min(1, maxSide / Math.max(w, h))
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", quality)
    if (!dataUrl || dataUrl.length < 100) return null
    return { dataUrl, timestampMs: Math.round(t * 1000) }
  } catch {
    return null
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}

function seekVideo(video: HTMLVideoElement, t: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const target = Math.max(0, t)
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      cleanup()
      if (ok) resolve()
      else reject(new Error("seek_error"))
    }
    const timer = window.setTimeout(() => finish(true), timeoutMs)
    const onSeeked = () => finish(true)
    const onError = () => finish(false)
    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("seeked", onSeeked, { once: true })
    video.addEventListener("error", onError, { once: true })
    try {
      if (Math.abs(video.currentTime - target) < 0.05) {
        finish(true)
        return
      }
      video.currentTime = target
    } catch {
      finish(false)
    }
  })
}
