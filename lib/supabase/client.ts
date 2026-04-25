import { createBrowserClient } from '@supabase/ssr'
import { validateSupabaseEnv } from '@/lib/supabase/config'

// Singleton client instance to prevent lock conflicts
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Return singleton if already created
  if (supabaseClient) {
    return supabaseClient
  }

  const { isConfigured, url, key, reason } = validateSupabaseEnv()

  // Handle missing env vars gracefully
  if (!isConfigured) {
    const setupMessage = `Supabase is not configured correctly: ${reason ?? 'Invalid configuration.'} Update .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.`

    // Return a mock client that won't break the build
    return {
      auth: {
        getUser: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: setupMessage } 
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

  // Create and cache the client (singleton pattern prevents lock conflicts)
  supabaseClient = createBrowserClient(url!, key!)

  return supabaseClient
}

// Export a function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return validateSupabaseEnv().isConfigured
}
