/** @type {import('next').NextConfig} */
/** Keep in sync with `canonicalSupabasePublicUrl` in lib/supabase/runtime-url.ts */
function canonicalSupabasePublicUrl(raw) {
  const s = (raw || '').trim().replace(/\/$/, '')
  if (!s) return ''
  try {
    const u = new URL(s)
    if (/\.supabase\.co$/i.test(u.hostname)) {
      const p = u.pathname.replace(/\/$/, '') || '/'
      if (p === '/rest/v1' || p.startsWith('/rest/v1/')) return u.origin
    }
    return s
  } catch {
    return (raw || '').trim()
  }
}

/** Match `legacyJwtProjectRef` in lib/supabase/jwt-project-ref.ts (dev-proxy runs only in Node here). */
function legacyJwtProjectRef(anonKey) {
  const k = (anonKey || '').trim()
  if (!k.startsWith('eyJ')) return null
  try {
    const segment = k.split('.')[1]
    if (!segment) return null
    const json = Buffer.from(segment, 'base64url').toString('utf8')
    const payload = JSON.parse(json)
    let raw = typeof payload.ref === 'string' ? payload.ref : null
    if (!raw && typeof payload.iss === 'string') {
      const m = payload.iss.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i)
      raw = m ? m[1] : null
    }
    if (!raw) return null
    return String(raw)
      .trim()
      .toLowerCase()
      .normalize('NFC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
  } catch {
    return null
  }
}

/** Same host resolution as `resolveCanonicalSupabaseOriginFromEnv()` so `/__supabase-dev-proxy` forwards correctly. */
function resolveDevProxySupabaseTarget() {
  let canonical = canonicalSupabasePublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()
  if (
    process.env.NODE_ENV === 'development' &&
    canonical.startsWith('https://') &&
    canonical.includes('.supabase.co')
  ) {
    const jwtRef = legacyJwtProjectRef(key)
    if (jwtRef) {
      try {
        const host = new URL(canonical).hostname.toLowerCase()
        const m = host.match(/^([a-z0-9]+)\.supabase\.co$/)
        const urlRef = m?.[1] ?? null
        if (urlRef && urlRef !== jwtRef) {
          canonical = `https://${jwtRef}.supabase.co`
        }
      } catch {
        /* noop */
      }
    }
  }
  return canonical.replace(/\/$/, '')
}

const buildForAndroid = process.env.BUILD_FOR_ANDROID === '1'
const staticExport = buildForAndroid
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  // NOTE: nonce injection happens in proxy.ts (Phase 4). This static policy
  // is a fallback for paths the proxy skips (static assets, images).
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://va.vercel-scripts.com https://app.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://storage.googleapis.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://storage.googleapis.com https://va.vercel-scripts.com https://app.posthog.com https://*.ingest.sentry.io https://*.sentry.io",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  poweredByHeader: false,
  /**
   * Dev: disable Next’s bundled dev terminal logging entirely (covers browser `[browser]` forward
   * plus noisy request logs). `logging.browserToTerminal: false` alone should suffice; full
   * `false` matches https://nextjs.org/docs/app/api-reference/config/next-config-js/logging .
   *
   * Production/`next build` keeps object form so schemas stay predictable.
   */
  logging:
    process.env.NODE_ENV !== "production" ? false : { browserToTerminal: false },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Static / Capacitor export cannot rely on Next's image optimizer.
    unoptimized: staticExport,
  },
  /** Dev-only: browser hits same-origin `/__supabase-dev-proxy/*`, Next forwards to real Supabase (fixes local ENOTFOUND / Failed to fetch). */
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return []
    if (process.env.NEXT_PUBLIC_SUPABASE_USE_DEV_PROXY !== "1") return []
    const target = resolveDevProxySupabaseTarget()
    if (!target?.startsWith("https://") || !target.includes(".supabase.co")) return []
    return [
      {
        source: "/__supabase-dev-proxy/:path*",
        destination: `${target}/:path*`,
      },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  ...(buildForAndroid && {
    output: 'export',
    assetPrefix: './',
    trailingSlash: true,
  }),
}

/**
 * Wrap with `withSentryConfig` when `@sentry/nextjs` is installed AND a DSN
 * is configured. This automatically uploads source maps during `next build`
 * with the auth token. When the SDK isn't installed we export the plain
 * config so CI and local dev stay green.
 */
async function withOptionalSentry(cfg) {
  if (!process.env.SENTRY_AUTH_TOKEN || !process.env.SENTRY_DSN) return cfg
  try {
    const mod = await import('@sentry/nextjs').catch(() => null)
    if (!mod?.withSentryConfig) return cfg
    return mod.withSentryConfig(cfg, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA },
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
    })
  } catch {
    return cfg
  }
}

export default await withOptionalSentry(nextConfig)
