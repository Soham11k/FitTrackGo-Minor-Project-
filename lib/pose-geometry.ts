import type { Landmark } from "./form-analysis"

const MIN_VIS_3D = 0.38

/**
 * 2D joint angle at B between segments BA and BC (image-normalized x,y).
 * Matches legacy `angle()` for backward compatibility.
 */
export function angle2d(a: Landmark, b: Landmark, c: Landmark): number {
  const ax = b.x - a.x
  const ay = b.y - a.y
  const cx = b.x - c.x
  const cy = b.y - c.y
  const dot = ax * cx + ay * cy
  const mag = Math.sqrt(ax * ax + ay * ay) * Math.sqrt(cx * cx + cy * cy) || 1
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

/**
 * 3D joint angle at B using vectors (a - b) and (c - b) in world/metric space.
 */
export function angle3d(a: Landmark, b: Landmark, c: Landmark): number {
  const ux = a.x - b.x
  const uy = a.y - b.y
  const uz = (a.z ?? 0) - (b.z ?? 0)
  const vx = c.x - b.x
  const vy = c.y - b.y
  const vz = (c.z ?? 0) - (b.z ?? 0)
  const dot = ux * vx + uy * vy + uz * vz
  const magU = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-6
  const magV = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-6
  return (Math.acos(Math.max(-1, Math.min(1, dot / (magU * magV)))) * 180) / Math.PI
}

function tripletVisible(va: number | undefined, vb: number | undefined, vc: number | undefined): boolean {
  return (va ?? 0) >= MIN_VIS_3D && (vb ?? 0) >= MIN_VIS_3D && (vc ?? 0) >= MIN_VIS_3D
}

function hasFiniteWorld3(p: Landmark | undefined): p is Landmark {
  if (!p) return false
  return Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)
}

/**
 * Joint angle at B: prefer 3D world coords when the triplet is available and
 * image visibilities are sufficient; else 2D image.
 */
export function jointAngle(
  a: Landmark,
  b: Landmark,
  c: Landmark,
  world: { a?: Landmark; b?: Landmark; c?: Landmark } | undefined
): number {
  const wa = world?.a
  const wb = world?.b
  const wc = world?.c
  if (hasFiniteWorld3(wa) && hasFiniteWorld3(wb) && hasFiniteWorld3(wc) && tripletVisible(a.visibility, b.visibility, c.visibility)) {
    return angle3d(wa, wb, wc)
  }
  return angle2d(a, b, c)
}

export function midLandmark(l: Landmark, r: Landmark): Landmark {
  return {
    x: (l.x + r.x) / 2,
    y: (l.y + r.y) / 2,
    z:
      l.z !== undefined && r.z !== undefined && Number.isFinite(l.z) && Number.isFinite(r.z)
        ? (l.z + r.z) / 2
        : undefined,
    visibility: Math.min(l.visibility ?? 0, r.visibility ?? 0),
  }
}

/**
 * |180° - angle| at hip: 0 = perfectly straight line shoulder–hip–ankle. Uses 3D when possible.
 */
export function hipPlumbLineDeviation(
  lShoulder: Landmark,
  rShoulder: Landmark,
  lHip: Landmark,
  rHip: Landmark,
  lAnkle: Landmark,
  rAnkle: Landmark,
  world?: {
    lShoulder: Landmark
    rShoulder: Landmark
    lHip: Landmark
    rHip: Landmark
    lAnkle: Landmark
    rAnkle: Landmark
  }
): { lineAngleDeg: number; deviationFromStraight: number; midS: Landmark; midH: Landmark; midA: Landmark } {
  const midS = midLandmark(lShoulder, rShoulder)
  const midH = midLandmark(lHip, rHip)
  const midA = midLandmark(lAnkle, rAnkle)
  let lineAngle: number
  if (
    world &&
    hasFiniteWorld3(world.lShoulder) &&
    hasFiniteWorld3(world.rShoulder) &&
    hasFiniteWorld3(world.lHip) &&
    hasFiniteWorld3(world.rHip) &&
    hasFiniteWorld3(world.lAnkle) &&
    hasFiniteWorld3(world.rAnkle) &&
    tripletVisible(midS.visibility, midH.visibility, midA.visibility)
  ) {
    const wS = midLandmark(world.lShoulder, world.rShoulder)
    const wH = midLandmark(world.lHip, world.rHip)
    const wA = midLandmark(world.lAnkle, world.rAnkle)
    lineAngle = angle3d(wS, wH, wA)
  } else {
    lineAngle = angle2d(midS, midH, midA)
  }
  const deviationFromStraight = Math.abs(180 - lineAngle)
  return { lineAngleDeg: lineAngle, deviationFromStraight, midS, midH, midA }
}
