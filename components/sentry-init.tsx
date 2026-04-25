"use client"

import { useEffect } from "react"
import { initSentry } from "@/lib/sentry"

/** Wires global error + unhandled rejection reporting once on mount. */
export function SentryInit() {
  useEffect(() => {
    initSentry()
  }, [])
  return null
}
