/**
 * Structured form-fault catalog consumed by the fault overlay renderer.
 *
 * Each fault has a stable id (for analytics + replay), a user-facing label,
 * the body region to highlight, the MediaPipe landmark indices the overlay
 * should draw over in red, and a severity that maps to stroke width +
 * whether to trigger a TTS cue.
 */

import type { Landmark, ExerciseId, FormRegion, FormResult } from "@/lib/form-analysis"
import { hasSpec } from "@/lib/form-engine/registry"
import { jointAngle } from "@/lib/pose-geometry"

export type FaultSeverity = "minor" | "moderate" | "severe"

export interface FormFault {
  id: string
  label: string
  cue: string
  region: FormRegion
  severity: FaultSeverity
  landmarkIndices: number[]
  /**
   * Optional explicit bone segments to stroke (MediaPipe index pairs).
   * Use when `landmarkIndices` is too narrow to match any row in the default
   * pose segment list (e.g. elbow-only faults need [11,13] / [12,14]).
   */
  segmentPairs?: [number, number][]
}

export interface FaultDetection {
  faults: FormFault[]
  analyzed: FormResult
}

/**
 * Landmark groups we commonly highlight. MediaPipe Pose indices.
 *   0        nose
 *   11/12    shoulders
 *   13/14    elbows
 *   15/16    wrists
 *   23/24    hips
 *   25/26    knees
 *   27/28    ankles
 */
const SHOULDERS = [11, 12]
const ELBOWS = [13, 14]
const WRISTS = [15, 16]
const HIPS = [23, 24]
const KNEES = [25, 26]
const ANKLES = [27, 28]
const TORSO = [...SHOULDERS, ...HIPS]
const LEGS = [...HIPS, ...KNEES, ...ANKLES]
const ARMS = [...SHOULDERS, ...ELBOWS, ...WRISTS]

function safe(lm: Landmark[], i: number): Landmark {
  return lm[i] ?? { x: 0, y: 0, z: 0, visibility: 0 }
}

function severityFor(deviation: number, thresholds: [number, number]): FaultSeverity {
  if (deviation >= thresholds[1]) return "severe"
  if (deviation >= thresholds[0]) return "moderate"
  return "minor"
}

/**
 * Map a coach spec id to the closest legacy overlay heuristic set.
 * When null, only generic breakdown-derived faults are shown.
 */
export function resolveFaultOverlayExercise(specId: string): ExerciseId | null {
  if (!hasSpec(specId)) {
    return specId === "squat" ||
      specId === "pushup" ||
      specId === "plank" ||
      specId === "lunge" ||
      specId === "deadlift" ||
      specId === "rdl" ||
      specId === "bicep_curl" ||
      specId === "shoulder_press" ||
      specId === "jumping_jacks" ||
      specId === "high_knees" ||
      specId === "crunch"
      ? (specId as ExerciseId)
      : null
  }
  if (specId.startsWith("pushup") || specId === "dip" || specId === "bench_dip") return "pushup"
  if (specId === "squat" || specId === "goblet_squat" || specId === "front_squat" || specId === "wall_sit") return "squat"
  if (
    specId === "lunge" ||
    specId === "bulgarian_split_squat" ||
    specId === "romanian_split_squat" ||
    specId === "step_up"
  )
    return "lunge"
  if (specId === "plank" || specId === "side_plank") return "plank"
  if (specId === "deadlift") return "deadlift"
  if (specId === "rdl") return "rdl"
  if (specId === "bicep_curl" || specId === "hammer_curl") return "bicep_curl"
  if (specId === "shoulder_press") return "shoulder_press"
  if (specId === "jumping_jacks") return "jumping_jacks"
  if (specId === "high_knees") return "high_knees"
  if (specId === "crunch" || specId === "sit_up" || specId === "bicycle_crunch") return "crunch"
  if (
    ["bench_press", "incline_bench_press", "lateral_raise", "front_raise", "overhead_tricep_extension", "face_pull", "reverse_fly"].includes(
      specId,
    )
  )
    return "shoulder_press"
  if (["leg_press", "leg_extension", "leg_curl", "calf_raise"].includes(specId)) return "squat"
  if (specId === "kettlebell_swing" || specId === "farmer_carry") return "deadlift"
  if (specId === "box_jump") return "jumping_jacks"
  return null
}

/**
 * Detect exercise-specific form faults from pose landmarks.
 *
 * Returns an array that can contain 0–N faults. The downstream overlay will
 * draw each fault's landmark set in red and label the primary one.
 */
export function detectFaults(
  lm: Landmark[],
  exercise: ExerciseId | string,
  analyzed: FormResult,
  world?: Landmark[]
): FaultDetection {
  const faults: FormFault[] = []
  if (!lm?.length) return { faults, analyzed }
  const overlay = resolveFaultOverlayExercise(String(exercise))
  if (!overlay) {
    for (const b of analyzed.breakdown) {
      if (b.ok) continue
      const region = b.region
      if (!region) continue
      faults.push({
        id: `generic.${region}`,
        label: b.label,
        cue: b.detail ?? b.label,
        region,
        severity: "minor",
        landmarkIndices: regionToIndices(region),
        segmentPairs: regionToSegmentPairs(region),
      })
    }
    return { faults, analyzed }
  }

  const w = (i: number) => world?.[i]
  const wTri = (a: number, b: number, c: number) =>
    w(a) && w(b) && w(c) ? { a: w(a)!, b: w(b)!, c: w(c)! } : undefined

  if (overlay === "squat") {
    const kneeL = jointAngle(safe(lm, 23), safe(lm, 25), safe(lm, 27), wTri(23, 25, 27))
    const kneeR = jointAngle(safe(lm, 24), safe(lm, 26), safe(lm, 28), wTri(24, 26, 28))
    const avgKnee = (kneeL + kneeR) / 2

    if (avgKnee > 140) {
      faults.push({
        id: "squat.shallow_depth",
        label: "Squat is too shallow",
        cue: "Go deeper — aim for knees at roughly 90°.",
        region: "legs",
        severity: severityFor(avgKnee - 140, [10, 25]),
        landmarkIndices: LEGS,
      })
    }

    const kneeXL = safe(lm, 25).x
    const ankleXL = safe(lm, 27).x
    const caveL = kneeXL - ankleXL
    const kneeXR = safe(lm, 26).x
    const ankleXR = safe(lm, 28).x
    const caveR = ankleXR - kneeXR
    const caveAvg = (caveL + caveR) / 2
    if (caveAvg > 0.035) {
      faults.push({
        id: "squat.knee_valgus",
        label: "Knees caving inward",
        cue: "Push knees out, track over your toes.",
        region: "legs",
        severity: severityFor(caveAvg - 0.035, [0.02, 0.05]),
        landmarkIndices: KNEES,
        segmentPairs: [
          [23, 25],
          [25, 27],
          [24, 26],
          [26, 28],
        ],
      })
    }

    const shoulderY = (safe(lm, 11).y + safe(lm, 12).y) / 2
    const hipY = (safe(lm, 23).y + safe(lm, 24).y) / 2
    const torsoLean = Math.abs(
      (safe(lm, 11).x + safe(lm, 12).x) / 2 -
        (safe(lm, 23).x + safe(lm, 24).x) / 2
    )
    if (shoulderY < hipY && torsoLean > 0.16) {
      faults.push({
        id: "squat.forward_lean",
        label: "Torso is leaning forward",
        cue: "Chest up — keep your torso tall.",
        region: "torso",
        severity: severityFor(torsoLean - 0.16, [0.06, 0.12]),
        landmarkIndices: TORSO,
      })
    }
  }

  if (overlay === "deadlift" || overlay === "rdl") {
    const midFootX = (safe(lm, 27).x + safe(lm, 28).x) / 2
    const midWristX = (safe(lm, 15).x + safe(lm, 16).x) / 2
    const drift = Math.abs(midWristX - midFootX)
    if (drift > 0.055) {
      faults.push({
        id: overlay === "rdl" ? "rdl.bar_drift" : "deadlift.bar_drift",
        label: "Bar drifting from mid-foot",
        cue: "Pull the bar straight up, close to your legs.",
        region: "arms",
        severity: severityFor(drift - 0.055, [0.03, 0.07]),
        landmarkIndices: [...WRISTS, ...ANKLES],
        segmentPairs: [
          [15, 16],
          [23, 25],
          [24, 26],
        ],
      })
    }
    const kneeL = jointAngle(safe(lm, 23), safe(lm, 25), safe(lm, 27), wTri(23, 25, 27))
    const kneeR = jointAngle(safe(lm, 24), safe(lm, 26), safe(lm, 28), wTri(24, 26, 28))
    const kneeAvg = (kneeL + kneeR) / 2
    if (overlay === "rdl" && kneeAvg < 130) {
      faults.push({
        id: "rdl.knees_too_bent",
        label: "Knees bending too much",
        cue: "It’s a hinge — push hips back with only a soft knee bend.",
        region: "legs",
        severity: severityFor(130 - kneeAvg, [8, 22]),
        landmarkIndices: LEGS,
      })
    }
    if (overlay === "deadlift" && kneeAvg > 155) {
      faults.push({
        id: "deadlift.knees_locked_early",
        label: "Knees overly straight early",
        cue: "Allow a modest knee bend to keep the bar close and hips low.",
        region: "legs",
        severity: severityFor(kneeAvg - 155, [5, 15]),
        landmarkIndices: LEGS,
      })
    }
  }

  if (overlay === "pushup") {
    const shoulderY = (safe(lm, 11).y + safe(lm, 12).y) / 2
    const hipY = (safe(lm, 23).y + safe(lm, 24).y) / 2
    const sag = shoulderY - hipY
    if (sag < -0.06) {
      faults.push({
        id: "pushup.hips_sagging",
        label: "Hips are sagging",
        cue: "Squeeze glutes — keep a straight line.",
        region: "torso",
        severity: severityFor(Math.abs(sag + 0.06), [0.04, 0.09]),
        landmarkIndices: TORSO,
      })
    }

    const elbowL = jointAngle(safe(lm, 11), safe(lm, 13), safe(lm, 15), wTri(11, 13, 15))
    const elbowR = jointAngle(safe(lm, 12), safe(lm, 14), safe(lm, 16), wTri(12, 14, 16))
    const avgElbow = (elbowL + elbowR) / 2
    if (avgElbow > 150) {
      faults.push({
        id: "pushup.shallow_elbow",
        label: "Shallow elbow bend",
        cue: "Lower deeper — aim for chest near the floor.",
        region: "arms",
        severity: severityFor(avgElbow - 150, [8, 18]),
        landmarkIndices: ARMS,
      })
    }
  }

  if (overlay === "plank") {
    const shoulderY = (safe(lm, 11).y + safe(lm, 12).y) / 2
    const hipY = (safe(lm, 23).y + safe(lm, 24).y) / 2
    const diff = hipY - shoulderY
    if (diff > 0.12) {
      faults.push({
        id: "plank.hips_high",
        label: "Hips too high",
        cue: "Lower your hips — form a straight line.",
        region: "core",
        severity: severityFor(diff - 0.12, [0.06, 0.12]),
        landmarkIndices: [...SHOULDERS, ...HIPS],
      })
    } else if (diff < -0.08) {
      faults.push({
        id: "plank.hips_low",
        label: "Hips dropping",
        cue: "Engage core — lift your hips to shoulder level.",
        region: "core",
        severity: severityFor(Math.abs(diff + 0.08), [0.05, 0.1]),
        landmarkIndices: [...SHOULDERS, ...HIPS],
      })
    }
  }

  if (overlay === "lunge") {
    const kL = jointAngle(safe(lm, 23), safe(lm, 25), safe(lm, 27), wTri(23, 25, 27))
    const kR = jointAngle(safe(lm, 24), safe(lm, 26), safe(lm, 28), wTri(24, 26, 28))
    const frontKnee = Math.min(kL, kR)
    if (frontKnee > 120) {
      faults.push({
        id: "lunge.short_step",
        label: "Step is too short",
        cue: "Step forward further — aim for 90° front knee.",
        region: "legs",
        severity: severityFor(frontKnee - 120, [12, 25]),
        landmarkIndices: LEGS,
      })
    }
  }

  if (overlay === "bicep_curl") {
    const elbowTravelL = Math.abs(safe(lm, 13).x - safe(lm, 11).x)
    const elbowTravelR = Math.abs(safe(lm, 14).x - safe(lm, 12).x)
    if (elbowTravelL > 0.08 || elbowTravelR > 0.08) {
      faults.push({
        id: "bicep_curl.elbow_flare",
        label: "Elbows drifting forward",
        cue: "Keep elbows pinned at your sides.",
        region: "arms",
        severity: severityFor(Math.max(elbowTravelL, elbowTravelR) - 0.08, [0.04, 0.08]),
        landmarkIndices: ELBOWS,
      })
    }
  }

  if (overlay === "shoulder_press") {
    const shoulderY = (safe(lm, 11).y + safe(lm, 12).y) / 2
    const hipY = (safe(lm, 23).y + safe(lm, 24).y) / 2
    const torsoArch = hipY - shoulderY
    if (torsoArch < 0.3) {
      faults.push({
        id: "shoulder_press.low_back_arch",
        label: "Lower back arching",
        cue: "Brace core — keep ribs down as you press.",
        region: "torso",
        severity: severityFor(0.3 - torsoArch, [0.05, 0.12]),
        landmarkIndices: TORSO,
      })
    }
  }

  // Carry breakdown-level failures as minor faults if we didn't already emit
  // a specific structured fault for the same region. This keeps the overlay
  // informative even for exercises that don't yet have a dedicated detector.
  for (const b of analyzed.breakdown) {
    if (b.ok) continue
    const region = b.region
    if (!region) continue
    if (faults.some((f) => f.region === region)) continue
    faults.push({
      id: `generic.${region}`,
      label: b.label,
      cue: b.detail ?? b.label,
      region,
      severity: "minor",
      landmarkIndices: regionToIndices(region),
      segmentPairs: regionToSegmentPairs(region),
    })
  }

  return { faults, analyzed }
}

export function regionToIndices(region: FormRegion): number[] {
  switch (region) {
    case "torso":
      return TORSO
    case "legs":
      return LEGS
    case "arms":
      return ARMS
    case "core":
      return [...SHOULDERS, ...HIPS]
  }
}

/** Bone segments to highlight for each form region (for generic + overlay). */
export function regionToSegmentPairs(region: FormRegion): [number, number][] {
  switch (region) {
    case "torso":
      return [
        [11, 12],
        [11, 23],
        [12, 24],
        [23, 24],
      ]
    case "legs":
      return [
        [23, 25],
        [25, 27],
        [24, 26],
        [26, 28],
      ]
    case "arms":
      return [
        [11, 13],
        [13, 15],
        [12, 14],
        [14, 16],
      ]
    case "core":
      return [
        [11, 12],
        [11, 23],
        [12, 24],
        [23, 24],
      ]
  }
}
