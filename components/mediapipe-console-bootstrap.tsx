"use client"

import { useLayoutEffect, useRef } from "react"
import {
  ensureMediapipeWarnFilterInstalled,
  prependMediapipeNoiseOuterDevLayerOnce,
} from "@/lib/mediapipe-console-noise"

/** After React attaches, prepend filter outermost so dev `[browser]` logs stay quiet. */
export function MediapipeConsoleBootstrap() {
  const ran = useRef(false)
  useLayoutEffect(() => {
    if (ran.current || typeof window === "undefined") return
    ran.current = true
    ensureMediapipeWarnFilterInstalled()
    prependMediapipeNoiseOuterDevLayerOnce()
    // #region agent log
    if (process.env.NODE_ENV === "development") {
      const inlined = process.env.__NEXT_BROWSER_DEBUG_INFO_IN_TERMINAL
      fetch("/api/debug-session-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "35ceb6",
          runId: "bundle-terminal-flag-check",
          hypothesisId: "H4",
          location: "components/mediapipe-console-bootstrap.tsx:bootstrap",
          message: "Mediapipe console bootstrap after filter install",
          data: {
            NEXT_BROWSER_DEBUG_INFO_IN_TERMINAL: inlined ?? null,
            note: "[browser] lines require Next forwarding; false should disable turbopack receiveBrowserLogs",
          },
          timestamp: Date.now(),
        }),
      })
        .catch(() => {})
        .finally(() => {
          fetch("/api/debug-terminal-snapshot").catch(() => {})
        })
    }
    // #endregion
  }, [])
  return null
}
