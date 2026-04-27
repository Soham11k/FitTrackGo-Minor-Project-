import { describe, it, expect } from "vitest"
import {
  normalizeFaceMeshToSignature,
  normalizeFaceMeshToSignatureForEnrollment,
  faceMeshQualityOk,
  faceMeshEnrollmentQualityOk,
  FACE_MESH_SUBSAMPLE_STEP,
  FACE_MESH_NOSE_TIP,
  FACE_MESH_LEFT_EYE_OUTER,
  FACE_MESH_RIGHT_EYE_OUTER,
  type MeshPoint,
} from "./face-mesh-signature"

function fakeMesh(): MeshPoint[] {
  const lm: MeshPoint[] = Array.from({ length: 480 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }))
  lm[FACE_MESH_NOSE_TIP] = { x: 0.5, y: 0.52, z: 0.01, visibility: 0.95 }
  lm[FACE_MESH_LEFT_EYE_OUTER] = { x: 0.42, y: 0.48, z: -0.01, visibility: 0.92 }
  lm[FACE_MESH_RIGHT_EYE_OUTER] = { x: 0.58, y: 0.48, z: 0.01, visibility: 0.92 }
  return lm
}

describe("faceMeshQualityOk", () => {
  it("rejects short arrays", () => {
    expect(faceMeshQualityOk([])).toBe(false)
    expect(faceMeshQualityOk(fakeMesh().slice(0, 50))).toBe(false)
  })

  it("accepts realistic mesh", () => {
    expect(faceMeshQualityOk(fakeMesh())).toBe(true)
  })

  it("enrollment accepts mesh when bulk visibility is omitted (Face Landmarker quirk)", () => {
    const m: MeshPoint[] = fakeMesh().map((p) => ({ x: p.x, y: p.y, z: p.z }))
    m[FACE_MESH_NOSE_TIP] = { x: 0.5, y: 0.52, z: 0.01, visibility: 0.95 }
    m[FACE_MESH_LEFT_EYE_OUTER] = { x: 0.42, y: 0.48, z: -0.01, visibility: 0.92 }
    m[FACE_MESH_RIGHT_EYE_OUTER] = { x: 0.58, y: 0.48, z: 0.01, visibility: 0.92 }
    expect(faceMeshQualityOk(m)).toBe(false)
    expect(faceMeshEnrollmentQualityOk(m)).toBe(true)
  })

  it("rejects dim mesh that enrollment still accepts", () => {
    const dim = fakeMesh().map((p) => ({ ...p, visibility: 0.1 }))
    dim[FACE_MESH_NOSE_TIP] = { ...dim[FACE_MESH_NOSE_TIP]!, visibility: 0.2 }
    dim[FACE_MESH_LEFT_EYE_OUTER] = { ...dim[FACE_MESH_LEFT_EYE_OUTER]!, visibility: 0.2 }
    dim[FACE_MESH_RIGHT_EYE_OUTER] = { ...dim[FACE_MESH_RIGHT_EYE_OUTER]!, visibility: 0.2 }
    expect(faceMeshQualityOk(dim)).toBe(false)
    expect(faceMeshEnrollmentQualityOk(dim)).toBe(true)
  })
})

describe("normalizeFaceMeshToSignature", () => {
  it("returns null when quality fails", () => {
    expect(normalizeFaceMeshToSignature([])).toBeNull()
  })

  it("returns L2-normalized vector of expected length", () => {
    const mesh = fakeMesh()
    const sig = normalizeFaceMeshToSignature(mesh)
    expect(sig).not.toBeNull()
    const expectedLen = Math.ceil(mesh.length / FACE_MESH_SUBSAMPLE_STEP) * 3
    expect(sig!.length).toBe(expectedLen)
    const norm = Math.sqrt(sig!.reduce((a, v) => a + v * v, 0))
    expect(norm).toBeCloseTo(1, 5)
  })

  it("matches self after identical mesh", () => {
    const mesh = fakeMesh()
    const a = normalizeFaceMeshToSignature(mesh)
    const b = normalizeFaceMeshToSignature(mesh.map((p) => ({ ...p })))
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    let dot = 0
    for (let i = 0; i < a!.length; i++) dot += a![i] * b![i]
    expect(dot).toBeCloseTo(1, 4)
  })

  it("enrollment normalize accepts zero visibility when geometry is valid", () => {
    const m = fakeMesh().map((p) => ({ ...p, visibility: 0 }))
    expect(faceMeshEnrollmentQualityOk(m)).toBe(false)
    expect(normalizeFaceMeshToSignatureForEnrollment(m)).not.toBeNull()
  })

  it("enrollment normalize accepts dim mesh when strict does not", () => {
    const dim = fakeMesh().map((p) => ({ ...p, visibility: 0.1 }))
    dim[FACE_MESH_NOSE_TIP] = { ...dim[FACE_MESH_NOSE_TIP]!, visibility: 0.2 }
    dim[FACE_MESH_LEFT_EYE_OUTER] = { ...dim[FACE_MESH_LEFT_EYE_OUTER]!, visibility: 0.2 }
    dim[FACE_MESH_RIGHT_EYE_OUTER] = { ...dim[FACE_MESH_RIGHT_EYE_OUTER]!, visibility: 0.2 }
    expect(normalizeFaceMeshToSignature(dim)).toBeNull()
    expect(normalizeFaceMeshToSignatureForEnrollment(dim)).not.toBeNull()
  })
})
