const GUEST_KEY = "ft-guest"

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1"
  } catch {
    return false
  }
}

export function markGuestMode(): void {
  try {
    window.localStorage.setItem(GUEST_KEY, "1")
  } catch {
    /* ignore */
  }
}

export function clearGuestMode(): void {
  try {
    window.localStorage.removeItem(GUEST_KEY)
  } catch {
    /* ignore */
  }
}
