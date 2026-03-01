/**
 * Secure context check for camera/geolocation.
 * Over HTTP (e.g. http://192.168.x.x:3000) browsers block these APIs and throw.
 * Use this to skip calling them and avoid console/UI errors.
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext === true
}
