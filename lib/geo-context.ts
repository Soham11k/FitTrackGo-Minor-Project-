/**
 * Browser Geolocation requires a secure context (HTTPS or trustworthy localhost).
 * Plain http://\<LAN-IP\> or http://0.0.0.0 is blocked — Run map shows fallback state.
 */

export function browserAllowsGeolocation(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext === true && Boolean(navigator.geolocation)
}

/** Why live GPS couldn't be used (best-effort; null = simulated path not due to explicit error yet). */
export type RunGeolocationFault =
  | "insecure_origin"
  | "no_api"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"

export function faultFromGeoError(code: number | undefined): RunGeolocationFault {
  switch (code) {
    case 1:
      return "permission_denied"
    case 2:
      return "position_unavailable"
    case 3:
      return "timeout"
    default:
      return "position_unavailable"
  }
}
