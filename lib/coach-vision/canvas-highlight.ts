import type { Landmark } from "@/lib/form-analysis"
import type { HighlightSpec } from "./cue-resolver"
import { renderHighlightSpec, type OverlayOptions } from "./fault-overlay"

export function overlayPulseFactor(reducedMotion: boolean): number {
  if (reducedMotion) return 0
  return Math.sin(performance.now() / 200) * 0.5 + 0.5
}

/** Draw user-selected cue highlight on top of an existing skeleton pass. */
export function drawCueFocusOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  highlight: HighlightSpec | null | undefined,
  width: number,
  height: number,
  reducedMotion: boolean,
  mirror = false,
): void {
  if (!highlight || !landmarks?.length) return
  const opts: OverlayOptions = {
    width,
    height,
    mirror,
    pulse: overlayPulseFactor(reducedMotion),
  }
  renderHighlightSpec(ctx, landmarks, highlight, opts)
}
