/**
 * Thin wrappers over the local profile store for body weight + unit preference.
 * Wider Supabase sync lives in `lib/store-supabase.ts`.
 */

import { getProfile, saveProfile } from "../store"
import type { WeightUnit } from "./units"

export function getBodyWeightKg(): number | undefined {
  return getProfile().bodyWeightKg
}

export function setBodyWeightKg(kg: number | undefined): void {
  saveProfile({ bodyWeightKg: kg })
}

export function getWeightUnit(): WeightUnit {
  return (getProfile().weightUnit as WeightUnit | undefined) ?? "kg"
}

export function setWeightUnit(u: WeightUnit): void {
  saveProfile({ weightUnit: u })
}
