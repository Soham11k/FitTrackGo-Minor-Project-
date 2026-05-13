/**
 * Strings MediaPipe Tasks Vision (WASM) emits via console APIs.
 * Not actionable in app code; filtered so dev `[browser]` forwarding stays quiet.
 * Keep matchers aligned with first-body `<script>` in app/layout.tsx.
 */

let mediapipeConsoleFilterInstalled = false

/** True once `ensureMediapipeWarnFilterInstalled()` has chained filters. */
export function isMediapipeBrowserFilterInstalled(): boolean {
  return mediapipeConsoleFilterInstalled
}

export function mediapipeWasmWarnArgsToText(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.message : String(a)))
    .join(" ")
}

export function isIgnorableMediapipeBrowserNoise(text: string): boolean {
  if (!text) return false
  if (text.includes("gl_context.cc") && text.includes("OpenGL error checking is disabled")) return true
  if (text.includes("FaceBlendshapesGraph") && text.includes("xnnpack")) return true
  if (text.includes("face_landmarker_graph")) return true
  if (text.includes("vision_wasm_internal")) return true
  if (text.includes("landmark_projection_calculator") && text.includes("NORM_RECT")) return true
  if (text.includes("inference_feedback_manager") && text.includes("Disabling support for feedback tensors"))
    return true
  /** Same message sometimes omits “Disabling support…” or uses localized wording tweaks. */
  if (text.includes("inference_feedback_manager") && text.includes("Feedback manager")) return true

  /** Glog-style WASM lines bundled with Mediapipe Tasks CDN / model URLs. */
  if (
    (/\bW\d+\s+[\d:.]+\s+\d+\s+\S+\.cc:\d+\]/.test(text) ||
      (/\.cc:\d+\]/.test(text) && /\bW\d{4}\s/.test(text))) &&
    (text.includes("tasks-vision") ||
      text.includes("vision_wasm_internal") ||
      text.includes("mediapipe-models") ||
      text.includes("wasm/vision"))
  )
    return true

  return false
}

const CONSOLE_SILENCE_KEYS = ["warn", "error", "log", "info", "debug"] as const

function chainConsoleNoiseFilter(): void {
  for (const key of CONSOLE_SILENCE_KEYS) {
    const prev = (console[key as keyof Console] as (...a: unknown[]) => void).bind(console)
    const next = (...args: unknown[]) => {
      const text = mediapipeWasmWarnArgsToText(args)
      if (isIgnorableMediapipeBrowserNoise(text)) return
      prev(...args)
    }
    ;(console as unknown as Record<string, typeof next>)[key] = next
  }
}

export function ensureMediapipeWarnFilterInstalled(): void {
  if (mediapipeConsoleFilterInstalled) return
  mediapipeConsoleFilterInstalled = true

  chainConsoleNoiseFilter()
}

let mediapipeOuterDevLayerAdded = false

/** Prepend one more swallow layer after dev tooling rewires console. */
export function prependMediapipeNoiseOuterDevLayerOnce(): void {
  if (mediapipeOuterDevLayerAdded || typeof window === "undefined") return
  mediapipeOuterDevLayerAdded = true

  chainConsoleNoiseFilter()
}

export async function withSuppressedMediapipeWasmWarn<T>(fn: () => Promise<T>): Promise<T> {
  return await fn()
}

if (typeof window !== "undefined") {
  ensureMediapipeWarnFilterInstalled()
}
