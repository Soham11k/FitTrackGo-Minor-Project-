import { describe, it, expect } from "vitest"
import {
  buildFaceSignature,
  faceMatches,
  passesCKFaceFilter,
  averageFaceSignatures,
  createFaceMatchSmoother,
} from "./face-verification"

/** 33 landmarks: face points 0–10 have realistic spread (not degenerate) so scale and cosine are well-defined. */
function baseFace(overrides: Partial<Record<number, { x: number; y: number; z?: number; visibility?: number }>> = {}) {
  const defaults: Record<number, { x: number; y: number; z: number; visibility: number }> = {
    0: { x: 0.5, y: 0.46, z: 0, visibility: 0.95 },
    1: { x: 0.5, y: 0.42, z: 0, visibility: 0.9 },
    2: { x: 0.4, y: 0.44, z: -0.02, visibility: 0.92 },
    3: { x: 0.35, y: 0.45, z: 0, visibility: 0.88 },
    4: { x: 0.45, y: 0.43, z: 0, visibility: 0.9 },
    5: { x: 0.6, y: 0.44, z: 0.02, visibility: 0.92 },
    6: { x: 0.65, y: 0.45, z: 0, visibility: 0.88 },
    7: { x: 0.55, y: 0.43, z: 0, visibility: 0.9 },
    8: { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
    9: { x: 0.45, y: 0.52, z: 0, visibility: 0.85 },
    10: { x: 0.55, y: 0.52, z: 0, visibility: 0.85 },
  }
  const lm = Array.from({ length: 33 }, (_, i) => {
    if (i <= 10) return { ...defaults[i]!, ...overrides[i] }
    return { x: 0.5, y: 0.7, z: 0, visibility: 0.5, ...overrides[i] }
  })
  return lm
}

describe("buildFaceSignature", () => {
  it("returns null when fewer than 11 landmarks", () => {
    expect(buildFaceSignature(baseFace().slice(0, 5) as never)).toBeNull()
  })

  it("returns a normalized vector when face is visible", () => {
    const sig = buildFaceSignature(baseFace() as never)
    expect(sig).not.toBeNull()
    expect(sig!.length).toBe(11 * 3)
  })
})

describe("passesCKFaceFilter", () => {
  it("fails when face landmarks are low visibility", () => {
    const low = baseFace(
      Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => [i, { x: 0.5, y: 0.5, visibility: 0.1 }])) as never
    )
    expect(passesCKFaceFilter(low as never)).toBe(false)
  })

  it("passes with enough visible face points", () => {
    expect(passesCKFaceFilter(baseFace() as never)).toBe(true)
  })
})

describe("faceMatches", () => {
  it("treats empty stored signature as match (no enrollment)", () => {
    const lm = baseFace() as never
    expect(faceMatches(lm, null)).toBe(true)
    expect(faceMatches(lm, [])).toBe(true)
  })

  it("matches identical pose-derived signatures", () => {
    const lm = baseFace() as never
    const sig = buildFaceSignature(lm)
    expect(sig).not.toBeNull()
    expect(faceMatches(lm, sig)).toBe(true)
  })
})

describe("averageFaceSignatures", () => {
  it("returns null for empty input", () => {
    expect(averageFaceSignatures([])).toBeNull()
  })

  it("averages two equal-length vectors", () => {
    const a = [1, 2, 3]
    const b = [3, 4, 5]
    expect(averageFaceSignatures([a, b])).toEqual([2, 3, 4])
  })
})

describe("createFaceMatchSmoother", () => {
  it("returns true when no stored signature", () => {
    const s = createFaceMatchSmoother()
    const lm = baseFace() as never
    expect(s(lm, null)).toBe(true)
  })

  it("uses rolling window for enrolled users (instant match passes through before window full)", () => {
    const lm = baseFace() as never
    const stored = buildFaceSignature(lm)
    expect(stored).not.toBeNull()
    const s = createFaceMatchSmoother()
    for (let i = 0; i < 4; i++) expect(s(lm, stored!)).toBe(true)
  })
})
