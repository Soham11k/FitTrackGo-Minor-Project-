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
  minor: 5,
  moderate: 7,
  severe: 9,
}

const SEVERITY_RANK: Record<FormFault["severity"], number> = {
  minor: 0,
  moderate: 1,
  severe: 2,
}

const MIN_VIS_SEGMENT = 0.28

export interface OverlayOptions {
  /** Video element's intrinsic width; used to scale landmark coords. */
  width: number
  /** Video element's intrinsic height; */
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

  const vis = (i: number) => landmarks[i]?.visibility ?? 1

  const project = (i: number): [number, number] | null => {
    const lm = landmarks[i]
    if (!lm) return null
    const x = mirror ? (1 - lm.x) * width : lm.x * width
    const y = lm.y * height
    return [x, y]
  }

  const sorted = [...faults].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
  )

  for (const fault of sorted) {
    const color = SEVERITY_COLORS[fault.severity]
    const baseWidth = SEVERITY_WIDTHS[fault.severity]
    const pulseAdd = fault.severity === "severe" ? pulse * 2.5 : fault.severity === "moderate" ? pulse * 1.2 : 0

    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const strokeSeg = (a: number, b: number) => {
      if (vis(a) < MIN_VIS_SEGMENT || vis(b) < MIN_VIS_SEGMENT) return
      const pa = project(a)
      const pb = project(b)
      if (!pa || !pb) return

      ctx.strokeStyle = "rgba(180, 20, 30, 0.45)"
      ctx.lineWidth = baseWidth + pulseAdd + 10
      ctx.beginPath()
      ctx.moveTo(pa[0], pa[1])
      ctx.lineTo(pb[0], pb[1])
      ctx.stroke()

      ctx.strokeStyle = color
      ctx.lineWidth = baseWidth + pulseAdd
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
      if (vis(idx) < MIN_VIS_SEGMENT) continue
      const p = project(idx)
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p[0], p[1], baseWidth + 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const LABEL_STACK_GAP = 44
  const forLabels = [...sorted].reverse()
  forLabels.slice(0, 2).forEach((fault, stackIdx) => {
    drawPrimaryLabel(ctx, fault, project, width, stackIdx * LABEL_STACK_GAP)
  })
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxInner: number): string {
  if (ctx.measureText(text).width <= maxInner) return text
  const ell = "…"
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const t = text.slice(0, mid) + ell
    if (ctx.measureText(t).width <= maxInner) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, Math.max(0, lo)) + ell
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

  const raw = fault.cue.length > 52 ? fault.label : fault.cue
  ctx.font = "600 16px 'Inter', system-ui, sans-serif"
  const padX = 12
  const maxBox = canvasWidth - 24
  const maxInner = maxBox - padX * 2
  const text = truncateToWidth(ctx, raw, maxInner)
  const metrics = ctx.measureText(text)
  const w = Math.min(metrics.width + padX * 2, maxBox)
  const h = 30

  const bx = Math.min(Math.max(x - w / 2, 6), canvasWidth - w - 6)
  const by = Math.max(y - h - 18 - yOffset, 6 + yOffset)

  ctx.fillStyle = "rgba(8, 8, 10, 0.92)"
  roundRect(ctx, bx, by, w, h, 10)
  ctx.fill()

  ctx.strokeStyle = SEVERITY_COLORS[fault.severity]
  ctx.lineWidth = 2
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

const POSITIVE_COLOR = "rgba(34, 197, 94, 0.95)"
const POSITIVE_GLOW = "rgba(34, 197, 94, 0.35)"

/** Draw a single focused fault (user tapped one improve cue). */
export function renderFocusedFault(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  fault: FormFault,
  opts: OverlayOptions
): void {
  renderFaults(ctx, landmarks, [fault], opts)
}

/** Green highlight on segments for positive "what went well" cues. */
export function renderPositiveHighlight(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  segmentPairs: [number, number][],
  opts: OverlayOptions
): void {
  if (!segmentPairs.length || !landmarks?.length) return

  const { width, height, mirror = false, pulse = 0 } = opts
  const vis = (i: number) => landmarks[i]?.visibility ?? 1

  const project = (i: number): [number, number] | null => {
    const lm = landmarks[i]
    if (!lm) return null
    const x = mirror ? (1 - lm.x) * width : lm.x * width
    const y = lm.y * height
    return [x, y]
  }

  const baseWidth = 6 + pulse * 1.5
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  for (const [a, b] of segmentPairs) {
    if (vis(a) < MIN_VIS_SEGMENT || vis(b) < MIN_VIS_SEGMENT) continue
    const pa = project(a)
    const pb = project(b)
    if (!pa || !pb) continue

    ctx.strokeStyle = POSITIVE_GLOW
    ctx.lineWidth = baseWidth + 8
    ctx.beginPath()
    ctx.moveTo(pa[0], pa[1])
    ctx.lineTo(pb[0], pb[1])
    ctx.stroke()

    ctx.strokeStyle = POSITIVE_COLOR
    ctx.lineWidth = baseWidth
    ctx.beginPath()
    ctx.moveTo(pa[0], pa[1])
    ctx.lineTo(pb[0], pb[1])
    ctx.stroke()
  }
}

/** Apply focused highlight from resolver spec on a canvas. */
export function renderHighlightSpec(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  spec: {
    kind: "improve" | "good"
    segmentPairs: [number, number][]
    fault?: FormFault
  },
  opts: OverlayOptions
): void {
  if (spec.kind === "good") {
    renderPositiveHighlight(ctx, landmarks, spec.segmentPairs, opts)
    return
  }
  if (spec.fault) {
    renderFocusedFault(ctx, landmarks, spec.fault, opts)
    return
  }
  const synthetic: FormFault = {
    id: "focused.generic",
    label: "Focus",
    cue: "",
    region: "torso",
    severity: "moderate",
    landmarkIndices: [],
    segmentPairs: spec.segmentPairs,
  }
  renderFocusedFault(ctx, landmarks, synthetic, opts)
}
