const DSN = process.env.SENTRY_DSN
const RELEASE = process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA

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
    | { init: (opts: Record<string, unknown>) => void }
    | null
  if (!Sentry) return
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0.1,
  })
}

init()

export {}
