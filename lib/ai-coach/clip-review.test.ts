import { describe, it, expect } from "vitest"
import {
  normalize,
  migrateClipReviewResult,
  parseVisionModelJsonPayload,
  perRepToLegacyFaults,
  type ClipReviewResult,
} from "./clip-review"

describe("clip-review normalize", () => {
  it("clamps repIndex and parses perRep good/improve", () => {
    const out = normalize(
      {
        summary: "ok",
        perRep: [
          { repIndex: -2, good: ["depth"], improve: ["a", "b"], score: 250 },
          { repIndex: 99, good: ["c"], improve: ["d"], score: -10 },
        ],
        topThreeFixes: ["x", "y", "z", "extra"],
        highlightRepIndex: 99,
      },
      3,
    )
    expect(out.perRep[0]).toMatchObject({
      repIndex: 0,
      good: ["depth"],
      improve: ["a", "b"],
      score: 100,
    })
    expect(out.perRep[2]).toMatchObject({
      repIndex: 2,
      good: ["c"],
      improve: ["d"],
      score: 0,
    })
    expect(out.topThreeFixes).toEqual(["x", "y", "z"])
    expect(out.highlightRepIndex).toBe(2)
    expect(out.perRepFaults[0].faults).toEqual(["a", "b"])
  })

  it("fills missing rep indices with empty shells", () => {
    const out = normalize({ summary: "x", perRep: [{ repIndex: 1, good: ["g"], improve: ["i"] }] }, 3)
    expect(out.perRep).toHaveLength(3)
    expect(out.perRep[0].good).toEqual([])
    expect(out.perRep[1].good).toEqual(["g"])
  })

  it("migrates legacy perRepFaults to perRep improve", () => {
    const out = normalize(
      {
        summary: "legacy",
        perRepFaults: [{ repIndex: 0, score: 72, faults: ["knees in"] }],
        topThreeFixes: ["brace core"],
        highlightRepIndex: 0,
      },
      2,
    )
    expect(out.perRep[0].improve).toEqual(["knees in"])
    expect(out.perRep[0].good).toEqual([])
    expect(out.perRepFaults[0].faults).toEqual(["knees in"])
  })

  it("handles missing fields", () => {
    const out: ClipReviewResult = normalize({}, 5)
    expect(out.summary).toBe("")
    expect(out.perRep).toHaveLength(5)
    expect(out.topThreeFixes).toEqual([])
    expect(out.highlightRepIndex).toBe(0)
  })

  it("filters non-string good/improve entries", () => {
    const out = normalize(
      {
        summary: "x",
        perRep: [{ repIndex: 0, good: ["a", 1, null], improve: ["b", false] }],
        topThreeFixes: [1, "b", null, "c"],
      },
      2,
    )
    expect(out.perRep[0].good).toEqual(["a"])
    expect(out.perRep[0].improve).toEqual(["b"])
    expect(out.topThreeFixes).toEqual(["b", "c"])
  })
})

describe("migrateClipReviewResult", () => {
  it("upgrades legacy cached payloads", () => {
    const migrated = migrateClipReviewResult(
      {
        summary: "s",
        perRepFaults: [{ repIndex: 0, faults: ["hip hinge"], score: 80 }],
        topThreeFixes: [],
        highlightRepIndex: 0,
      },
      1,
    )
    expect(migrated?.perRep[0].improve).toEqual(["hip hinge"])
  })
})

describe("perRepToLegacyFaults", () => {
  it("maps improve to faults", () => {
    expect(
      perRepToLegacyFaults([{ repIndex: 0, good: [], improve: ["x"], score: 90 }]),
    ).toEqual([{ repIndex: 0, faults: ["x"], score: 90 }])
  })
})

describe("parseVisionModelJsonPayload", () => {
  const minimal = {
    summary: "ok",
    perRep: [{ repIndex: 0, good: ["depth"], improve: [], score: 80 }],
    topThreeFixes: ["a"],
    highlightRepIndex: 0,
  }

  it("parses fenced ```json blocks", () => {
    const raw = "```json\n" + JSON.stringify(minimal) + "\n```"
    const o = parseVisionModelJsonPayload(raw) as ClipReviewResult
    expect(typeof o.summary).toBe("string")
    expect((o as { summary: string }).summary).toBe("ok")
  })
})
