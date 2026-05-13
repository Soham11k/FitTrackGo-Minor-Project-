/**
 * Weight unit helpers. Storage is always kilograms; display follows the
 * user's `UserProfile.weightUnit` preference.
 */

export type WeightUnit = "kg" | "lb"

const KG_PER_LB = 0.45359237

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

/** Format a kilogram value for display in the user's preferred unit. */
export function formatLoad(kg: number | undefined, unit: WeightUnit = "kg", opts: { showUnit?: boolean; precision?: number } = {}): string {
  if (kg === undefined || Number.isNaN(kg)) return "—"
  const showUnit = opts.showUnit ?? true
  const precision = opts.precision ?? 1
  const value = unit === "lb" ? kgToLb(kg) : kg
  const rounded = precision === 0 ? Math.round(value) : Number(value.toFixed(precision))
  // Drop trailing ".0"
  const display = String(rounded).replace(/\.0$/, "")
  return showUnit ? `${display} ${unit}` : display
}

/** Round a kilogram value to the nearest 0.5 kg (or 1 lb when in lb mode). */
export function snapLoad(kg: number, unit: WeightUnit = "kg"): number {
  if (unit === "lb") {
    return lbToKg(Math.round(kgToLb(kg)))
  }
  return Math.round(kg * 2) / 2
}
