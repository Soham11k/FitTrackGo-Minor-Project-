/**
 * Render red segment overlays + labels on the coach canvas for every
 * detected fault. Designed to run on top of whatever skeleton the existing
 * pose renderer already draws.
 */
import type { FormFault } from "./faults"
import type { Landmark } from "@/lib/form-analysis"

const POSE_SEGMENTS: Array<[number, number]> = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
]

const SEVERITY_COLORS: Record<FormFault["severity"], string> = {
  /** Was yellow; use vivid error tone so "problem area" reads clearly on video. */
  minor: "rgba(255, 75, 65, 0.94)",
  moderate: "rgba(255, 50, 45, 0.96)",
  severe: "rgba(235, 25, 40, 0.99)",
}

const SEVERITY_WIDTHS: Record<FormFault["severity"], number> = {
  minor: 4,
  moderate: 6,
  severe: 8,
}

export interface OverlayOptions {
  /** Video element's intrinsic width; used to scale landmark coords. */
  width: number
  /** Video element's intrinsic height. */
  height: number
  /** Mirror landmarks horizontally (selfie / front-facing camera). */
  mirror?: boolean
  /** Optional time-based pulse factor (0..1); caller passes Math.sin(t/200)/2+0.5. */
  pulse?: number
}

export function renderFaults(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  faults: FormFault[],
  opts: OverlayOptions
): void {
  if (!faults.length || !landmarks?.length) return

  const { width, height, mirror = false, pulse = 0 } = opts

  const project = (i: number): [number, number] | null => {
    const lm = landmarks[i]
    if (!lm) return null
    const x = mirror ? (1 - lm.x) * width : lm.x * width
    const y = lm.y * height
    return [x, y]
  }

  for (const fault of faults) {
    const color = SEVERITY_COLORS[fault.severity]
    const baseWidth = SEVERITY_WIDTHS[fault.severity]
    const pulseAdd = fault.severity === "severe" ? pulse * 2 : 0

    ctx.strokeStyle = color
    ctx.lineWidth = baseWidth + pulseAdd
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const strokeSeg = (a: number, b: number) => {
      const pa = project(a)
      const pb = project(b)
      if (!pa || !pb) return
      ctx.beginPath()
      ctx.moveTo(pa[0], pa[1])
      ctx.lineTo(pb[0], pb[1])
      ctx.stroke()
    }

    if (fault.segmentPairs?.length) {
      for (const [a, b] of fault.segmentPairs) {
        strokeSeg(a, b)
      }
    } else {
      for (const [a, b] of POSE_SEGMENTS) {
        if (!fault.landmarkIndices.includes(a) || !fault.landmarkIndices.includes(b)) {
          continue
        }
        strokeSeg(a, b)
      }
    }

    ctx.fillStyle = color
    for (const idx of fault.landmarkIndices) {
      const p = project(idx)
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p[0], p[1], baseWidth + 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Show up to 2 fault labels stacked vertically
  const LABEL_STACK_GAP = 40
  faults.slice(0, 2).forEach((fault, stackIdx) => {
    drawPrimaryLabel(ctx, fault, project, width, stackIdx * LABEL_STACK_GAP)
  })
}

function drawPrimaryLabel(
  ctx: CanvasRenderingContext2D,
  fault: FormFault,
  project: (i: number) => [number, number] | null,
  canvasWidth: number,
  yOffset: number = 0
) {
  const anchor =
    project(fault.landmarkIndices[0]) ??
    project(11) ??
    project(0) ??
    [canvasWidth / 2, 40]
  const [x, y] = anchor

  const text = fault.label
  ctx.font = "600 15px 'Inter', system-ui, sans-serif"
  const metrics = ctx.measureText(text)
  const padX = 10
  const w = metrics.width + padX * 2
  const h = 28

  const bx = Math.min(Math.max(x - w / 2, 6), canvasWidth - w - 6)
  const by = Math.max(y - h - 16 - yOffset, 6 + yOffset)

  ctx.fillStyle = "rgba(10, 10, 12, 0.90)"
  roundRect(ctx, bx, by, w, h, 10)
  ctx.fill()

  ctx.strokeStyle = SEVERITY_COLORS[fault.severity]
  ctx.lineWidth = 1.5
  roundRect(ctx, bx, by, w, h, 10)
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.textBaseline = "middle"
  ctx.fillText(text, bx + padX, by + h / 2)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
