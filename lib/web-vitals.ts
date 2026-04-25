/**
 * Web-vitals → analytics + Sentry. Call `reportWebVitals` from the Next
 * `useReportWebVitals` hook; it will forward each metric to PostHog and
 * as a breadcrumb/tag into Sentry.
 */
import { track } from "@/lib/analytics"
import { captureMessage } from "@/lib/sentry"

type Metric = {
  id: string
  name: string
  label?: "web-vital" | "custom"
  value: number
  delta?: number
  rating?: "good" | "needs-improvement" | "poor"
  navigationType?: string
}

const POOR_THRESHOLDS: Partial<Record<Metric["name"], number>> = {
  LCP: 4000,
  CLS: 0.25,
  FID: 300,
  INP: 500,
  TTFB: 1800,
  FCP: 3000,
}

export function reportWebVitals(metric: Metric) {
  try {
    track("web_vital", {
      name: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating ?? "unknown",
    })
  } catch {
    /* noop */
  }

  const threshold = POOR_THRESHOLDS[metric.name]
  if (threshold != null && metric.value > threshold) {
    captureMessage(`web-vital:${metric.name} poor (${metric.value.toFixed(1)})`, "warning")
  }
}
