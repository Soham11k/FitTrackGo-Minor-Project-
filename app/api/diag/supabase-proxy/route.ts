/**
 * Dev-only diagnostics for Supabase connectivity + dev proxy loopback.
 * GET /api/diag/supabase-proxy while `npm run dev` is running.
 */
import dns from 'node:dns'
import { NextResponse, type NextRequest } from 'next/server'
import { validateSupabaseEnv } from '@/lib/supabase/config'
import { resetDevSupabaseProbeCache } from '@/lib/supabase/dev-reachability'
import { supabaseHealthProbeOk } from '@/lib/supabase/health-probe-ok'
import {
  getSupabaseUrlForServer,
  isSupabaseDevProxyEnabled,
} from '@/lib/supabase/runtime-url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

dns.setDefaultResultOrder('ipv4first')

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (request.nextUrl.searchParams.get('fresh') === '1') {
    resetDevSupabaseProbeCache()
  }

  const v = validateSupabaseEnv()
  const devProxy = isSupabaseDevProxyEnabled()
  const appUrlGuess = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || null

  let serverHost = ''
  try {
    serverHost = new URL(getSupabaseUrlForServer()).hostname
  } catch {
    serverHost = 'invalid-url'
  }

  let directProbe: { ok: boolean; status?: number; err?: string } = { ok: false }
  let loopProbe: { ok: boolean; status?: number; err?: string } | null = null
  let supabaseComProbe: { ok: boolean; status?: number; err?: string } = { ok: false }

  try {
    const r = await fetch('https://supabase.com', { method: 'HEAD', cache: 'no-store' })
    supabaseComProbe = { ok: r.ok, status: r.status }
  } catch (e) {
    supabaseComProbe = {
      ok: false,
      err: (e instanceof Error ? e.message : String(e)).slice(0, 200),
    }
  }

  if (v.isConfigured && v.key) {
    const origin = getSupabaseUrlForServer().replace(/\/$/, '')
    try {
      const r = await fetch(`${origin}/auth/v1/health`, {
        headers: { apikey: v.key, Authorization: `Bearer ${v.key}` },
        cache: 'no-store',
      })
      directProbe = { ok: supabaseHealthProbeOk(r.status), status: r.status }
    } catch (e) {
      directProbe = {
        ok: false,
        err: (e instanceof Error ? e.message : String(e)).slice(0, 400),
      }
    }

    if (devProxy) {
      const loopBase = appUrlGuess ?? 'http://127.0.0.1:3000'
      try {
        const r = await fetch(`${loopBase}/api/supabase-dev-proxy/auth/v1/health`, {
          headers: { apikey: v.key, Authorization: `Bearer ${v.key}` },
          cache: 'no-store',
        })
        loopProbe = { ok: supabaseHealthProbeOk(r.status), status: r.status }
      } catch (e) {
        loopProbe = {
          ok: false,
          err: (e instanceof Error ? e.message : String(e)).slice(0, 400),
        }
      }
    }
  }

  let hint: string | null = null
  if (devProxy && directProbe.ok && loopProbe && !loopProbe.ok) {
    hint =
      'Loopback to /api/supabase-dev-proxy failed while direct Supabase worked. Restart dev and set NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000.'
  }
  if (v.isConfigured && !directProbe.ok && loopProbe?.ok) {
    hint = 'Direct Supabase failed but dev proxy works — browser auth should use the proxy (default in dev).'
  }
  if (v.isConfigured && !directProbe.ok && (!loopProbe || !loopProbe.ok)) {
    if (supabaseComProbe.ok) {
      hint =
        `Your .env keys are valid, but the project API (${serverHost}) is not reachable from here (ECONNRESET / connection reset). The dashboard can work while this host does not. In Chrome open https://${serverHost}/auth/v1/health — you need JSON, not an error page. Then Supabase → Restart project, or create a new project and paste new URL + keys into .env.local. Run npm run check:supabase-host. Continue as guest works without Supabase.`
    } else {
      hint =
        'Cannot reach Supabase (supabase.com and your project API both failed). Check internet, VPN, or firewall, then run npm run check:supabase-host.'
    }
  }

  const authReachable = Boolean(directProbe.ok || loopProbe?.ok)

  return NextResponse.json({
    configured: v.isConfigured,
    validationReason: v.reason ?? null,
    devProxyEnabled: devProxy,
    serverHostname: serverHost,
    nextPublicAppUrlSet: Boolean(appUrlGuess),
    loopbackBaseUsed: devProxy ? appUrlGuess ?? 'http://127.0.0.1:3000' : null,
    supabaseComReachable: supabaseComProbe,
    directAuthHealth: directProbe,
    proxyLoopbackAuthHealth: loopProbe,
    authReachable,
    hint,
  })
}
