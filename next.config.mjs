/** @type {import('next').NextConfig} */
const buildForAndroid = process.env.BUILD_FOR_ANDROID === '1'
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
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
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
