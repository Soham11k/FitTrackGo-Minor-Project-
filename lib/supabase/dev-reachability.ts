import { validateSupabaseEnv } from '@/lib/supabase/config'
import { supabaseHealthProbeOk } from '@/lib/supabase/health-probe-ok'
import { markSupabaseReachable, markSupabaseUnreachable } from '@/lib/supabase/connectivity-circuit'
import { getSupabaseUrlForServer } from '@/lib/supabase/runtime-url'

const PROBE_TTL_MS = 120_000

type DevReachGlobal = typeof globalThis & {
  __ftSupabaseDevReachable?: boolean
  __ftSupabaseDevProbedAt?: number
  __ftSupabaseDevProbePromise?: Promise<boolean>
}

function devG(): DevReachGlobal {
  return globalThis as DevReachGlobal
}

/** Dev: force the next probe to hit the network (e.g. after Restore or .env.local edit). */
export function resetDevSupabaseProbeCache(): void {
  const g = devG()
  g.__ftSupabaseDevProbedAt = undefined
  g.__ftSupabaseDevReachable = undefined
  g.__ftSupabaseDevProbePromise = undefined
}

function cacheDevReachable(ok: boolean): void {
  const g = devG()
  g.__ftSupabaseDevReachable = ok
  g.__ftSupabaseDevProbedAt = Date.now()
  if (ok) markSupabaseReachable()
  else markSupabaseUnreachable()
}

async function probeSupabaseHealth(): Promise<boolean> {
  const v = validateSupabaseEnv()
  if (!v.isConfigured || !v.key) {
    cacheDevReachable(false)
    return false
  }

  const origin = getSupabaseUrlForServer().replace(/\/$/, '')
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`${origin}/auth/v1/health`, {
      headers: { apikey: v.key, Authorization: `Bearer ${v.key}` },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    // 2xx/401 = host accepted TLS; 5xx (e.g. Next error page) = not reachable.
    const reachable = supabaseHealthProbeOk(r.status)
    cacheDevReachable(reachable)
    return reachable
  } catch {
    cacheDevReachable(false)
    return false
  }
}

/** Server/Edge: cached health probe (at most once per TTL per isolate). */
export async function getDevSupabaseReachable(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') return true

  const g = devG()
  const now = Date.now()
  if (
    g.__ftSupabaseDevProbedAt != null &&
    now - g.__ftSupabaseDevProbedAt < PROBE_TTL_MS &&
    g.__ftSupabaseDevReachable !== undefined
  ) {
    return g.__ftSupabaseDevReachable
  }

  if (!g.__ftSupabaseDevProbePromise) {
    g.__ftSupabaseDevProbePromise = probeSupabaseHealth().finally(() => {
      g.__ftSupabaseDevProbePromise = undefined
    })
  }
  return g.__ftSupabaseDevProbePromise
}

export type SupabaseDiagPayload = {
  authReachable?: boolean
  hint?: string | null
  serverHostname?: string
}

/** Browser: same-origin diag (also drives connectivity banner). */
export async function primeSupabaseDevFromDiag(): Promise<SupabaseDiagPayload | null> {
  if (process.env.NODE_ENV !== 'development') return { authReachable: true }
  try {
    const r = await fetch('/api/diag/supabase-proxy?fresh=1', { cache: 'no-store' })
    const j = (await r.json()) as SupabaseDiagPayload
    const ok = Boolean(j.authReachable)
    cacheDevReachable(ok)
    return j
  } catch {
    cacheDevReachable(false)
    return null
  }
}
