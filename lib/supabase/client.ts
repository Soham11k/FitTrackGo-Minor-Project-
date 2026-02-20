import { createBrowserClient } from '@supabase/ssr'

// Singleton client instance to prevent lock conflicts
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // Return singleton if already created
  if (supabaseClient) {
    return supabaseClient
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check if Supabase is configured
  const isConfigured = url && key && 
    url !== 'your-project-url-here' && 
    key !== 'your-anon-key-here' &&
    url.startsWith('https://') &&
    (key.startsWith('eyJ') || key.startsWith('sb_publishable_'))

  // Handle missing env vars gracefully
  if (!isConfigured) {
    // Return a mock client that won't break the build
    return {
      auth: {
        getUser: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: 'Supabase not configured. Please set up your .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. See SETUP-CHECKLIST.md for instructions.' } 
        }),
        signUp: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: 'Supabase not configured. Please set up your .env.local file. See SETUP-CHECKLIST.md for instructions.' } 
        }),
        signInWithPassword: () => Promise.resolve({ 
          data: { user: null }, 
          error: { message: 'Supabase not configured. Please set up your .env.local file. See SETUP-CHECKLIST.md for instructions.' } 
        }),
        signInWithOAuth: () => Promise.resolve({ 
          error: { message: 'Supabase not configured. Please set up your .env.local file. See SETUP-CHECKLIST.md for instructions.' } 
        }),
        signOut: () => Promise.resolve({ error: null }),
        resetPasswordForEmail: () => Promise.resolve({ 
          error: { message: 'Supabase not configured. Please set up your .env.local file. See SETUP-CHECKLIST.md for instructions.' } 
        }),
        onAuthStateChange: () => ({ 
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
    } as any
  }

  // Create and cache the client (singleton pattern prevents lock conflicts)
  supabaseClient = createBrowserClient(url, key)

  return supabaseClient
}

// Export a function to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!(url && key && 
    url !== 'your-project-url-here' && 
    key !== 'your-anon-key-here' &&
    url.startsWith('https://') &&
    (key.startsWith('eyJ') || key.startsWith('sb_publishable_')))
}
