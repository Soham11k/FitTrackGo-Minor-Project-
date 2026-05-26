import type { FormSpec } from "@/lib/form-engine/types"

export type UserCustomExerciseRow = {
  id: string
  user_id: string
  spec_id: string
  display_name: string
  description: string
  form_spec: FormSpec
  camera_note: string | null
  created_at: string
  updated_at: string
}

export type UserCustomExercise = {
  id: string
  specId: string
  displayName: string
  description: string
  spec: FormSpec
  cameraNote?: string
  createdAt: string
  updatedAt: string
}

export function rowToCustomExercise(row: UserCustomExerciseRow): UserCustomExercise {
  return {
    id: row.id,
    specId: row.spec_id,
    displayName: row.display_name,
    description: row.description,
    spec: row.form_spec,
    cameraNote: row.camera_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
