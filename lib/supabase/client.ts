import { createBrowserClient } from '@supabase/ssr'
import { validateSupabaseEnv, normalizePublicEnvScalar } from '@/lib/supabase/config'
import { getSupabaseUrlForRuntime } from '@/lib/supabase/runtime-url'

// Singleton client instance to prevent lock conflicts.
// Cache must invalidate when public env changes — otherwise a stale client survives bad URL/key edits during dev.
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null
let cachedPublicEnvFingerprint: string | null = null

function publicSupabaseEnvFingerprint(): string {
  const url = normalizePublicEnvScalar(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = normalizePublicEnvScalar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return `${url}\n${key}`
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

    // Return a mock client that won't break the build
    return {
      auth: {
        getUser: () => Promise.resolve({
          data: { user: null },
          error: { message: setupMessage },
        }),
        getSession: () => Promise.resolve({
          data: { session: null },
          error: { message: setupMessage },
        }),
        signUp: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: setupMessage } 
        }),
        signInWithPassword: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: setupMessage } 
        }),
        signInWithOAuth: () => Promise.resolve({ 
          error: { message: setupMessage } 
        }),
        signOut: () => Promise.resolve({ error: null }),
        resetPasswordForEmail: () => Promise.resolve({ 
          error: { message: setupMessage } 
        }),
        onAuthStateChange: (_cb: (...args: unknown[]) => void) => ({
          data: { subscription: { unsubscribe: () => {} } }
        }),
      },
      from: () => ({
        select: () => ({ 
          eq: () => ({ 
            single: () => Promise.resolve({ 
              data: null, 
              error: { message: 'Supabase not configured' } 
            }) 
          }) 
        }),
        insert: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
        update: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
        upsert: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
        delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
      }),
    } as unknown as ReturnType<typeof createBrowserClient>
  }

  supabaseClient = createBrowserClient(getSupabaseUrlForRuntime(), key!)

  return supabaseClient
}

// Export a function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return validateSupabaseEnv().isConfigured
}
