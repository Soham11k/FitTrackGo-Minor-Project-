/**
 * Thin product-analytics facade. PostHog is loaded lazily via CDN when
 * `NEXT_PUBLIC_POSTHOG_KEY` is configured; otherwise every function is a
 * no-op. PII (emails, phone numbers) never crosses this boundary: we only
 * track user ids and opaque event payloads.
 *
 * Core events (keep this list small — event bloat is real):
 *   - workout_started          { category, exercise_count }
 *   - workout_completed        { category, duration_sec, calories }
 *   - run_completed            { distance_km, duration_sec, pace }
 *   - coach_session_saved      { exercise, reps, score, form_faults }
 *   - export_downloaded        { format: "json" | "gpx" }
 *   - onboarding_completed     { goals: string[], level }
 *   - fitbit_connected         { scopes }
 *   - push_subscribed          { }
 *   - program_enrolled         { program_slug }
 *   - program_day_completed    { program_slug, day_index }
 */

type Props = Record<string, string | number | boolean | null | undefined | string[]>

interface PostHogLike {
  init: (key: string, opts: Record<string, unknown>) => void
  capture: (event: string, props?: Props) => void
  identify: (id: string, props?: Props) => void
  reset: () => void
  screen?: (name: string, props?: Props) => void
}

declare global {
  interface Window {
    posthog?: PostHogLike
  }
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"

let loaded = false
let initialized = false

async function loadAndInit() {
  if (!KEY || loaded || typeof window === "undefined") return
  loaded = true
  try {
    // Dynamic CDN snippet avoids adding a hard runtime dep.
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = `${HOST}/static/array.js`
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("posthog script load failed"))
      document.head.appendChild(script)
    })
    if (window.posthog) {
      window.posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: true,
        persistence: "localStorage",
        autocapture: false,
        disable_session_recording: true,
        respect_dnt: true,
      })
      initialized = true
    }
  } catch {
    /* swallow; analytics must never break the app */
  }
}

export function bootAnalytics() {
  if (typeof window === "undefined") return
  if (!KEY) return
  if (loaded) return
  if (document.readyState === "complete") {
    void loadAndInit()
  } else {
    window.addEventListener("load", () => void loadAndInit(), { once: true })
  }
}

export function track(event: string, props?: Props) {
  if (typeof window === "undefined") return
  try {
    window.posthog?.capture(event, props)
  } catch {
    /* noop */
  }
  if (!initialized && process.env.NODE_ENV !== "production") {
    // Helpful when running locally without PostHog configured.
    console.debug("[analytics]", event, props)
  }
}

export function identify(id: string, props?: Props) {
  if (typeof window === "undefined") return
  try {
    window.posthog?.identify(id, props)
  } catch {
    /* noop */
  }
}

export function screen(name: string, props?: Props) {
  track("screen_view", { name, ...props })
}

export function resetAnalytics() {
  try {
    window.posthog?.reset()
  } catch {
    /* noop */
  }
}
