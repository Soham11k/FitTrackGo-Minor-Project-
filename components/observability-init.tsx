"use client"

import { useEffect } from "react"
import { useReportWebVitals } from "next/web-vitals"
import { initSentry } from "@/lib/sentry"
import { bootAnalytics } from "@/lib/analytics"
import { reportWebVitals } from "@/lib/web-vitals"

/**
 * Consolidates observability side-effects so the layout only mounts one
 * client component: Sentry global error handlers, PostHog bootstrap, and
 * web-vitals reporting.
 */
export function ObservabilityInit() {
  useReportWebVitals(reportWebVitals)
  useEffect(() => {
    initSentry()
    bootAnalytics()
  }, [])
  return null
}
