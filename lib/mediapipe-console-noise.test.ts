import { describe, it, expect } from "vitest"
import { isIgnorableMediapipeBrowserNoise } from "./mediapipe-console-noise"

describe("isIgnorableMediapipeBrowserNoise", () => {
  it("matches landmark_projection + tasks-vision URL in one line", () => {
    expect(
      isIgnorableMediapipeBrowserNoise(
        "W0511 13:24:22.830000 2158768 landmark_projection_calculator.cc:81] Using NORM_RECT without IMAGE_DIMENSIONS ... (https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_internal.js:8368:22)"
      )
    ).toBe(true)
  })

  it("matches inference_feedback_manager glog line with colon timestamp (no Disabling… substring)", () => {
    expect(
      isIgnorableMediapipeBrowserNoise(
        "W0511 13:24:22.841999 2158768 inference_feedback_manager.cc:121] Feedback manager requires a model with a single signature inference. (https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm/vision_wasm_internal.js:8368:22)"
      )
    ).toBe(true)
  })

  it("does not swallow unrelated warnings", () => {
    expect(isIgnorableMediapipeBrowserNoise("React state update on unmounted component")).toBe(false)
  })
})
