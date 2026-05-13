/**
 * Browser console noise from MediaPipe WASM (Playwright strict console checks).
 *
 * @see README-SETUP.md (Troubleshooting → MediaPipe console warnings)
 */
import { isIgnorableMediapipeBrowserNoise } from "@/lib/mediapipe-console-noise"

export const MEDIAPIPE_WASM_NOISE_SUBSTRINGS = [
  "face_landmarker_graph",
  "gl_context.cc",
  "vision_wasm_internal",
] as const

export function isIgnorableBrowserConsoleNoise(text: string): boolean {
  return isIgnorableMediapipeBrowserNoise(text)
}
