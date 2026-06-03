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

  /** TFLite XNNPACK delegate INFO is emitted via console.error; not actionable. */
  if (/INFO:\s*Created TensorFlow Lite XNNPACK|XNNPACK delegate/i.test(text)) return true

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

const FILTER_MARK = Symbol("mediapipeConsoleFilter")

type ConsoleFn = (...args: unknown[]) => void

/** True native methods captured before any module patching (inline layout script may run first). */
const nativeConsole: Partial<Record<(typeof CONSOLE_SILENCE_KEYS)[number], ConsoleFn>> = {}

function captureNativeConsoleOnce(): void {
  if (nativeConsole.error) return
  for (const key of CONSOLE_SILENCE_KEYS) {
    nativeConsole[key] = (console[key as keyof Console] as ConsoleFn).bind(console)
  }
}

function markFilter(fn: ConsoleFn): ConsoleFn {
  ;(fn as ConsoleFn & { [FILTER_MARK]?: boolean })[FILTER_MARK] = true
  return fn
}

function isMarkedFilter(fn: unknown): fn is ConsoleFn {
  return typeof fn === "function" && (fn as { [FILTER_MARK]?: boolean })[FILTER_MARK] === true
}

function chainConsoleNoiseFilter(forceOuter = false): void {
  captureNativeConsoleOnce()
  for (const key of CONSOLE_SILENCE_KEYS) {
    const current = console[key as keyof Console] as ConsoleFn
    if (!forceOuter && isMarkedFilter(current)) continue

    const downstream = forceOuter ? current.bind(console) : (nativeConsole[key] ?? current.bind(console))
    const next: ConsoleFn = (...args: unknown[]) => {
      const text = mediapipeWasmWarnArgsToText(args)
      if (isIgnorableMediapipeBrowserNoise(text)) return
      if (downstream === next) {
        nativeConsole[key]?.(...args)
        return
      }
      downstream(...args)
    }
    ;(console as unknown as Record<string, ConsoleFn>)[key] = markFilter(next)
  }
}

export function ensureMediapipeWarnFilterInstalled(): void {
  if (mediapipeConsoleFilterInstalled) return
  mediapipeConsoleFilterInstalled = true

  chainConsoleNoiseFilter(false)
}

let mediapipeOuterDevLayerAdded = false

/** Prepend one more swallow layer after dev tooling rewires console. */
export function prependMediapipeNoiseOuterDevLayerOnce(): void {
  if (mediapipeOuterDevLayerAdded || typeof window === "undefined") return
  mediapipeOuterDevLayerAdded = true

  chainConsoleNoiseFilter(true)
}

export async function withSuppressedMediapipeWasmWarn<T>(fn: () => Promise<T>): Promise<T> {
  return await fn()
}

if (typeof window !== "undefined") {
  ensureMediapipeWarnFilterInstalled()
}
