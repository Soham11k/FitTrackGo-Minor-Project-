"use client"

import { useEffect } from "react"

/**
 * `next dev -H 0.0.0.0` exposes the app at a host (`0.0.0.0`) that differs from Supabase/Google
 * “localhost” redirect allowlists and from typical magic-link redirects. SPA fallback if inline
 * script in layout didn’t run.
 */
export function AuthListenerHostFix() {
  useEffect(() => {
    try {
      const { hostname } = window.location
      if (hostname === "0.0.0.0" || hostname === "[::]" || hostname === "::") {
        const u = new URL(window.location.href)
        u.hostname = "localhost"
        window.location.replace(u.toString())
      }
    } catch {
      /* ignore */
    }
  }, [])
  return null
}
