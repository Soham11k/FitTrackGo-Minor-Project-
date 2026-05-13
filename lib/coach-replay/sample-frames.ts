/**
 * Client-side frame sampler. Decodes a WebM blob in a hidden <video>,
 * seeks to evenly-spaced timestamps, and snapshots each frame to a
 * downscaled JPEG data URL.
 */

import type { ClipReviewFrame } from "@/lib/ai-coach/clip-review"

export async function sampleFramesFromBlob(
  blob: Blob,
  opts: { count?: number; maxSide?: number; quality?: number } = {}
): Promise<ClipReviewFrame[]> {
  const count = Math.max(3, Math.min(40, opts.count ?? 8))
  const maxSide = opts.maxSide ?? 480
  const quality = opts.quality ?? 0.7

  const url = URL.createObjectURL(blob)
  const video = document.createElement("video")
  video.preload = "auto"
  video.muted = true
  video.playsInline = true
  video.crossOrigin = "anonymous"
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("video_decode_error"))
    })
    const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    if (duration === 0) return []

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return []

    const frames: ClipReviewFrame[] = []
    for (let i = 0; i < count; i++) {
      const t = duration * ((i + 0.5) / count)
      await seekVideo(video, t)
      const w = video.videoWidth || 640
      const h = video.videoHeight || 360
      const scale = Math.min(1, maxSide / Math.max(w, h))
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL("image/jpeg", quality)
      frames.push({ dataUrl, timestampMs: Math.round(t * 1000) })
    }
    return frames
  } finally {
    try { video.src = "" } catch { /* ignore */ }
    URL.revokeObjectURL(url)
  }
}

function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve() }
    const onError = () => { cleanup(); reject(new Error("seek_error")) }
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
    }
    video.addEventListener("seeked", onSeeked, { once: true })
    video.addEventListener("error", onError, { once: true })
    video.currentTime = Math.max(0, t)
  })
}
