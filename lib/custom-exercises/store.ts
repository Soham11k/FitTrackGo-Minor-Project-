/**
 * Client persistence for user custom exercises + runtime registry sync.
 */

import { createClient } from "@/lib/supabase/client"
import {
  clearUserSpecs,
  registerUserSpecs,
  unregisterUserSpec,
} from "@/lib/form-engine/registry"
import type { FormSpec } from "@/lib/form-engine/types"
import { buildCustomSpecId, validateFormSpec } from "@/lib/form-engine/validate-spec"
import { rowToCustomExercise, type UserCustomExercise, type UserCustomExerciseRow } from "./types"

export const MAX_CUSTOM_EXERCISES_PER_USER = 20

function getSupabase() {
  return createClient()
}

export async function fetchUserCustomExercises(): Promise<UserCustomExercise[]> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("user_custom_exercises")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.warn("[custom-exercises] fetch failed:", error.message)
    return []
  }

  return ((data ?? []) as UserCustomExerciseRow[]).map(rowToCustomExercise)
}

/** Load from Supabase and merge into the in-memory FormSpec registry. */
export async function hydrateUserCustomExercises(): Promise<UserCustomExercise[]> {
  const rows = await fetchUserCustomExercises()
  clearUserSpecs()
  registerUserSpecs(rows.map((r) => r.spec))
  return rows
}

export type SaveCustomExerciseInput = {
  displayName: string
  description: string
  spec: FormSpec
  cameraNote?: string
  /** When updating, pass existing spec_id */
  specId?: string
}

export async function saveCustomExercise(
  input: SaveCustomExerciseInput,
): Promise<{ ok: true; exercise: UserCustomExercise } | { ok: false; error: string }> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Sign in to save custom exercises." }

  const specId = input.specId?.trim() || buildCustomSpecId(input.displayName)
  const validated = validateFormSpec(input.spec, specId)
  if (!validated.ok) {
    return { ok: false, error: validated.errors.join("; ") }
  }

  const spec = { ...validated.spec, id: specId }

  if (!input.specId) {
    const { count, error: countErr } = await supabase
      .from("user_custom_exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countErr) {
      return { ok: false, error: countErr.message }
    }
    if ((count ?? 0) >= MAX_CUSTOM_EXERCISES_PER_USER) {
      return {
        ok: false,
        error: `You can save up to ${MAX_CUSTOM_EXERCISES_PER_USER} custom exercises. Delete one to add another.`,
      }
    }
  }

  const row = {
    user_id: user.id,
    spec_id: specId,
    display_name: input.displayName.trim(),
    description: input.description.trim(),
    form_spec: spec,
    camera_note: input.cameraNote?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("user_custom_exercises")
    .upsert(row, { onConflict: "user_id,spec_id" })
    .select("*")
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  const exercise = rowToCustomExercise(data as UserCustomExerciseRow)
  registerUserSpecs([exercise.spec])
  return { ok: true, exercise }
}

export async function deleteCustomExercise(specId: string): Promise<boolean> {
  const supabase = getSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from("user_custom_exercises")
    .delete()
    .eq("user_id", user.id)
    .eq("spec_id", specId)

  if (error) {
    console.warn("[custom-exercises] delete failed:", error.message)
    return false
  }
  unregisterUserSpec(specId)
  return true
}
