/**
 * Sentry browser client config. Active only when `NEXT_PUBLIC_SENTRY_DSN` is
 * set AND `@sentry/nextjs` is installed. Uses an indirect dynamic import so
 * builds without the SDK remain green.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
const RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA

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

async function init() {
  if (!DSN) return
  const Sentry = (await loadSentry()) as
    | {
        init: (opts: Record<string, unknown>) => void
        browserTracingIntegration?: () => unknown
        replayIntegration?: (opts: Record<string, unknown>) => unknown
      }
    | null
  if (!Sentry) return
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      ...(Sentry.browserTracingIntegration ? [Sentry.browserTracingIntegration()] : []),
      ...(Sentry.replayIntegration
        ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
        : []),
    ],
    beforeSend(event: { request?: { cookies?: Record<string, string> } }) {
      if (event.request?.cookies) delete event.request.cookies
      return event
    },
  })
}

init()

export {}
