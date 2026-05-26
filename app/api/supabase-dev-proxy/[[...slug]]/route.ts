/**
 * Dev-only: forward `/api/supabase-dev-proxy/*` → `https://<ref>.supabase.co/*`.
 * Must live under `app/api/` (folders starting with `_` are private and never route in Next.js).
 */
import dns from 'node:dns'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isSupabaseDevProxyEnabled,
  resolveCanonicalSupabaseOriginFromEnv,
} from '@/lib/supabase/runtime-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PROXY_PREFIX = '/api/supabase-dev-proxy'

/** Prefer IPv4 — broken IPv6 paths to Supabase often surface as ECONNRESET on macOS. */
dns.setDefaultResultOrder('ipv4first')

const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'keep-alive',
  'transfer-encoding',
  'sec-fetch-site',
  'sec-fetch-mode',
  'sec-fetch-dest',
  'sec-fetch-user',
  'referer',
])

// #region agent log
function proxyDebugLog(payload: Record<string, unknown>): void {
  try {
    const dir = join(process.cwd(), '.cursor')
    mkdirSync(dir, { recursive: true })
    appendFileSync(
      join(dir, 'debug-2a41e9.log'),
      `${JSON.stringify({ sessionId: '2a41e9', timestamp: Date.now(), hypothesisId: 'H-proxy', runId: 'proxy-v2', ...payload })}\n`
    )
  } catch {
    /* noop */
  }
}
// #endregion

async function forward(req: NextRequest): Promise<Response> {
  if (!isSupabaseDevProxyEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const upstreamOrigin = resolveCanonicalSupabaseOriginFromEnv().replace(/\/$/, '')
  if (!upstreamOrigin.startsWith('https://') || !upstreamOrigin.includes('.supabase.co')) {
    return NextResponse.json({ error: 'Invalid Supabase origin for dev proxy' }, { status: 500 })
  }

  const stripped = req.nextUrl.pathname.replace(new RegExp(`^${PROXY_PREFIX}/?`), '')
  const pathPart = stripped ? `/${stripped}` : ''
  const targetUrl = `${upstreamOrigin}${pathPart}${req.nextUrl.search}`

  // #region agent log
  proxyDebugLog({
    message: 'proxy forward start',
    data: { method: req.method, pathPart: pathPart.slice(0, 80), upstreamHost: new URL(targetUrl).hostname },
  })
  // #endregion

  const headers = new Headers(req.headers)
  for (const h of DROP_REQUEST_HEADERS) {
    headers.delete(h)
  }
  for (const [name] of [...headers.entries()]) {
    if (name.toLowerCase().startsWith('x-forwarded-') || name.toLowerCase().startsWith('x-vercel-')) {
      headers.delete(name)
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  try {
    const upstream = await fetch(targetUrl, init)
    // #region agent log
    proxyDebugLog({
      message: 'proxy forward ok',
      data: { status: upstream.status, method: req.method },
    })
    // #endregion
    const out = new Headers(upstream.headers)
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error && err.cause != null
          ? String(err.cause)
          : undefined
    // #region agent log
    proxyDebugLog({
      message: 'proxy upstream fetch threw',
      level: 'error',
      data: { errMsg: msg.slice(0, 300), cause: cause?.slice(0, 200) },
    })
    // #endregion
    return NextResponse.json(
      { error: 'Upstream fetch failed', detail: msg.slice(0, 200), cause },
      { status: 502 }
    )
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const PATCH = forward
export const DELETE = forward
export const OPTIONS = forward
