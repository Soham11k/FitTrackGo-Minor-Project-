const LOCAL_KEY = "fittrackgo_coach_replay_local_v1"
const SYNC_KEY = "fittrackgo_coach_clip_sync_v1"

export function isCoachReplayLocalEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw === null) return true
    return raw === "1"
  } catch {
    return true
  }
}

export function setCoachReplayLocalEnabled(on: boolean) {
  try {
    localStorage.setItem(LOCAL_KEY, on ? "1" : "0")
  } catch { /* noop */ }
}

export function isCoachClipCloudSyncEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(SYNC_KEY) === "1"
  } catch {
    return false
  }
}

export function setCoachClipCloudSyncEnabled(on: boolean) {
  try {
    localStorage.setItem(SYNC_KEY, on ? "1" : "0")
  } catch { /* noop */ }
}

export function coachClipsCloudFeatureFlag(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_COACH_CLIPS === "1"
}
