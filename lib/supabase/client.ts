import { createBrowserClient } from '@supabase/ssr'
import { validateSupabaseEnv, normalizePublicEnvScalar } from '@/lib/supabase/config'
import {
  markSupabaseUnreachable,
  shouldSkipSupabaseNetwork,
} from '@/lib/supabase/connectivity-circuit'
import { getSupabaseUrlForRuntime } from '@/lib/supabase/runtime-url'

const UNREACHABLE_DEV_MSG =
  'Supabase project API is unreachable. Restore it at app.supabase.com (paused projects) or run npm run check:supabase-host.'

export function invalidateSupabaseBrowserClient(): void {
  supabaseClient = null
  cachedPublicEnvFingerprint = null
}

// Singleton client instance to prevent lock conflicts.
// Cache must invalidate when public env changes — otherwise a stale client survives bad URL/key edits during dev.
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null
let cachedPublicEnvFingerprint: string | null = null

function publicSupabaseEnvFingerprint(): string {
  const url = normalizePublicEnvScalar(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = normalizePublicEnvScalar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return `${url}\n${key}`
}

function buildMockSupabaseClient(message: string): ReturnType<typeof createBrowserClient> {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: null },
          error: { message },
        }),
      getSession: () =>
        Promise.resolve({
          data: { session: null },
          error: { message },
        }),
      signUp: () => Promise.resolve({ data: { user: null }, error: { message } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: { message } }),
      signInWithOAuth: () => Promise.resolve({ error: { message } }),
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: () => Promise.resolve({ error: { message } }),
      onAuthStateChange: (_cb: (...args: unknown[]) => void) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: { message } }),
        }),
      }),
      insert: () => Promise.resolve({ error: { message } }),
      update: () => ({ eq: () => Promise.resolve({ error: { message } }) }),
      upsert: () => Promise.resolve({ error: { message } }),
      delete: () => ({ eq: () => Promise.resolve({ error: { message } }) }),
    }),
  } as unknown as ReturnType<typeof createBrowserClient>
}

export function createClient() {
  const fingerprint = publicSupabaseEnvFingerprint()
  if (supabaseClient && cachedPublicEnvFingerprint === fingerprint) {
    return supabaseClient
  }

  supabaseClient = null
  cachedPublicEnvFingerprint = fingerprint

  const { isConfigured, key, reason } = validateSupabaseEnv()

  // Handle missing env vars gracefully
  if (!isConfigured) {
    const setupMessage = `Supabase is not configured correctly: ${reason ?? 'Invalid configuration.'} Update .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.`
    return buildMockSupabaseClient(setupMessage)
  }

  // In dev, keep using the real client when Supabase recovers (circuit only blocks production mock).
  if (shouldSkipSupabaseNetwork() && process.env.NODE_ENV !== 'development') {
    return buildMockSupabaseClient(UNREACHABLE_DEV_MSG)
  }

  const runtimeUrl = getSupabaseUrlForRuntime()
  supabaseClient = createBrowserClient(runtimeUrl, key!, {
    auth: {
      autoRefreshToken: process.env.NODE_ENV !== 'development',
    },
  })

  return supabaseClient
}

// Export a function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return validateSupabaseEnv().isConfigured
}

