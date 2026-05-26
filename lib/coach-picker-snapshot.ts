const KEY = "ft-coach-picker-snapshot-v1"

export type CoachPickerSnapshot = {
  v: 1
  coachTrack: "strength" | "mobility"
  coachPickerStep: "families" | "variants"
  selectedFamilyId: string | null
}

export function saveCoachPickerSnapshot(s: Omit<CoachPickerSnapshot, "v">): void {
  if (typeof window === "undefined") return
  try {
    const payload: CoachPickerSnapshot = {
      v: 1,
      coachTrack: s.coachTrack,
      coachPickerStep: s.coachPickerStep,
      selectedFamilyId: s.selectedFamilyId,
    }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* quota / private */
  }
}

export function loadCoachPickerSnapshot(): CoachPickerSnapshot | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as CoachPickerSnapshot
    if (o?.v !== 1) return null
    if (o.coachTrack !== "strength" && o.coachTrack !== "mobility") return null
    if (o.coachPickerStep !== "families" && o.coachPickerStep !== "variants") return null
    if (o.selectedFamilyId != null && typeof o.selectedFamilyId !== "string") return null
    return o
  } catch {
    return null
  }
}
