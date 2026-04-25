/**
 * Unified Sentry facade.
 *
 * If `@sentry/nextjs` is installed, we delegate to it (full source-map,
 * release, tracing, replay). Otherwise we fall back to a tiny self-hosted
 * reporter posting to `/api/report-error` so error capture still works
 * in development or sandbox envs where the SDK isn't available.
 */

type SentryLike = {
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void
  captureMessage: (msg: string, level?: "info" | "warning" | "error") => void
  setTag: (key: string, value: string) => void
  setUser: (user: { id?: string | null; email?: string | null } | null) => void
}

const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

let nativeSentry: SentryLike | null = null

// Use an indirect import so TS/webpack don't force-bundle @sentry/nextjs when
// it's not installed. The spec name is a string literal so it still bundles
// if the dep exists; try/catch swallows module-not-found otherwise.
async function loadSentry(): Promise<Record<string, unknown> | null> {
  try {
    const dynamicImport = Function("s", "return import(s)") as (
      s: string
    ) => Promise<Record<string, unknown>>
    return await dynamicImport("@sentry/nextjs")
  } catch {
    return null
  }
}

;(async () => {
  if (!SENTRY_DSN) return
  try {
    const mod = (await loadSentry()) as
      | {
          captureException: (e: unknown, ctx?: unknown) => void
          captureMessage: (m: string, l?: string) => void
          setTag?: (k: string, v: string) => void
          setUser?: (u: unknown) => void
        }
      | null
    if (!mod) return
    nativeSentry = {
      captureException: (e: unknown, ctx?: Record<string, unknown>) =>
        mod.captureException(e, { extra: ctx }),
      captureMessage: (msg: string, level?: "info" | "warning" | "error") =>
        mod.captureMessage(msg, level),
      setTag: (k: string, v: string) => mod.setTag?.(k, v),
      setUser: (u: { id?: string | null; email?: string | null } | null) =>
        mod.setUser?.(u),
    }
  } catch {
    /* stay on shim */
  }
})()

export function initSentry() {
  if (!SENTRY_DSN) return

  if (typeof window === "undefined") return

  window.addEventListener("error", (event) => {
    reportShim({
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    })
  })
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason
    reportShim({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      type: "unhandledrejection",
    })
  })
}

interface ShimPayload {
  message: string
  stack?: string
  filename?: string
  lineno?: number
  colno?: number
  type?: string
}

function reportShim(payload: ShimPayload) {
  if (!SENTRY_DSN) return
  const url = process.env.NEXT_PUBLIC_ERROR_REPORTING_URL || "/api/report-error"
  try {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        sentryDsn: SENTRY_DSN,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* noop */
  }
}

export function captureException(error: Error | unknown, context?: Record<string, unknown>) {
  if (nativeSentry) {
    nativeSentry.captureException(error, context)
    return
  }
  const msg = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  if (process.env.NODE_ENV !== "production") {
    console.error("[sentry-shim]", msg, context)
  }
  reportShim({ message: msg, stack, ...context })
}

export function captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
  if (nativeSentry) {
    nativeSentry.captureMessage(message, level)
    return
  }
  reportShim({ message, type: level })
}

/** Tag the current scope with a route, e.g. "coach", "run", "api:wearables". */
export function tagRoute(route: string) {
  nativeSentry?.setTag("route", route)
}

export function identifySentryUser(user: { id?: string | null; email?: string | null } | null) {
  nativeSentry?.setUser(user)
}
