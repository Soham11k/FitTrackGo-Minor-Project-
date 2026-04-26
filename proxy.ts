import { type NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Edge entry for Next.js 16+ (Turbopack): CSP nonces + Supabase session refresh
 * via `updateSession`. Only this root `proxy.ts` is allowed — do not add
 * `middleware.ts` (build error: middleware-to-proxy).
 *
 * We set `x-nonce` for the root layout and mirror CSP on the response (stricter
 * than next.config.mjs). Inline scripts (theme / accent bootstrap) must use
 * `nonce={nonce}`. Third-party script hosts are allowlisted explicitly.
 */
export async function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const nonce = toBase64(crypto.getRandomValues(new Uint8Array(16)))

  const isDev = process.env.NODE_ENV !== 'production'
  const mediapipeCdn = 'https://cdn.jsdelivr.net'
  const vercelScripts = 'https://va.vercel-scripts.com'
  const posthog = 'https://app.posthog.com'

  // In dev Next injects its own inline+eval for HMR. We relax those only in dev.
  const scriptExtra = isDev ? "'unsafe-eval'" : ''

  const csp = [
    "default-src 'self'",
    // Strict script policy with per-request nonce; MediaPipe is loaded from jsdelivr.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${scriptExtra} ${mediapipeCdn} ${vercelScripts} ${posthog} https://*.sentry.io`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://storage.googleapis.com",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${mediapipeCdn} ${vercelScripts} ${posthog} https://*.ingest.sentry.io https://*.sentry.io https://storage.googleapis.com`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  // Propagate nonce to route handlers / layout via request header clone.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)

  const sessionResponse = await updateSession(request, requestId)
  const response = sessionResponse ??
    NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('x-request-id', requestId)
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', csp)

  return response
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return typeof btoa === 'function'
    ? btoa(s)
    : Buffer.from(bytes).toString('base64')
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|^/login|^/auth|api/health|api/wearables(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
