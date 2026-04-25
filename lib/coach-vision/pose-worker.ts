/**
 * Pose-inference Web Worker entry point.
 *
 * This worker accepts `ImageBitmap`s from the main thread, runs the
 * MediaPipe Tasks Vision pose landmarker, and posts landmarks back to the
 * main thread. Moving the hot loop off the main thread keeps the UI at 60fps
 * even on mid-tier Androids.
 *
 * Messages:
 *   { type: "init", modelUrl: string }
 *   { type: "frame", bitmap: ImageBitmap, timestamp: number, frameId: number }
 *   { type: "close" }
 *
 * Responses:
 *   { type: "ready" }
 *   { type: "landmarks", frameId, landmarks, worldLandmarks, timestamp }
 *   { type: "error", message }
 */
/// <reference lib="webworker" />

type WorkerScope = DedicatedWorkerGlobalScope & {
  poseLandmarker?: unknown
}
const ctx: WorkerScope = self as unknown as WorkerScope

type VisionModule = {
  FilesetResolver: { forVisionTasks: (u: string) => Promise<unknown> }
  PoseLandmarker: {
    createFromOptions: (fs: unknown, opts: Record<string, unknown>) => Promise<{
      detectForVideo: (
        b: ImageBitmap,
        ts: number
      ) => { landmarks?: unknown[]; worldLandmarks?: unknown[] }
      close?: () => void
    }>
  }
}

let landmarker: Awaited<
  ReturnType<VisionModule["PoseLandmarker"]["createFromOptions"]>
> | null = null

async function loadMediaPipe(modelUrl: string) {
  const mod = (await import(
    /* webpackChunkName: "mediapipe" */ "@mediapipe/tasks-vision"
  )) as unknown as VisionModule
  const fileset = await mod.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
  )
  landmarker = await mod.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  })
}

ctx.addEventListener("message", async (ev: MessageEvent) => {
  const msg = ev.data as
    | { type: "init"; modelUrl: string }
    | { type: "frame"; bitmap: ImageBitmap; timestamp: number; frameId: number }
    | { type: "close" }

  try {
    if (msg.type === "init") {
      await loadMediaPipe(msg.modelUrl)
      ctx.postMessage({ type: "ready" })
      return
    }

    if (msg.type === "frame") {
      if (!landmarker) {
        ctx.postMessage({
          type: "error",
          message: "pose-worker: frame received before init",
        })
        msg.bitmap.close?.()
        return
      }
      const res = landmarker.detectForVideo(msg.bitmap, msg.timestamp)
      ctx.postMessage({
        type: "landmarks",
        frameId: msg.frameId,
        landmarks: res.landmarks ?? [],
        worldLandmarks: res.worldLandmarks ?? [],
        timestamp: msg.timestamp,
      })
      msg.bitmap.close?.()
      return
    }

    if (msg.type === "close") {
      landmarker?.close?.()
      landmarker = null
      ctx.close()
    }
  } catch (err) {
    ctx.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    })
  }
})

export {}
