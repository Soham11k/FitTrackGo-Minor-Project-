export type DistanceUnit = 'km' | 'mi'

const STORAGE_KEY = 'fittrackgo_distance_unit'

export function getStoredUnit(): DistanceUnit {
  if (typeof window === 'undefined') return 'km'
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'mi') return 'mi'
  } catch {}
  return 'km'
}

export function setStoredUnit(unit: DistanceUnit) {
  try {
    localStorage.setItem(STORAGE_KEY, unit)
  } catch {}
}

export function convertDistance(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km * 0.621371 : km
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  const val = convertDistance(km, unit)
  return `${val.toFixed(2)} ${unit}`
}
