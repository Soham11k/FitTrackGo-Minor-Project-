import { describe, it, expect, vi } from "vitest"
import { renderPositiveHighlight } from "./fault-overlay"

describe("fault-overlay: renderPositiveHighlight", () => {
  it("does not throw with empty landmarks", () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: "",
      lineJoin: "",
      strokeStyle: "",
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    expect(() =>
      renderPositiveHighlight(ctx, [], [], {
        width: 640,
        height: 480,
        mirror: false,
        pulse: 0,
      }),
    ).not.toThrow()
  })

  it("does not throw with empty segmentPairs", () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: "",
      lineJoin: "",
      strokeStyle: "",
      lineWidth: 0,
    } as unknown as CanvasRenderingContext2D

    expect(() =>
      renderPositiveHighlight(ctx, [{ x: 0.5, y: 0.5, visibility: 1 }], [], {
        width: 640,
        height: 480,
        mirror: false,
        pulse: 0,
      }),
    ).not.toThrow()
  })
})

