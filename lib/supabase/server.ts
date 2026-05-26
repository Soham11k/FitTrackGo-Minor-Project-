import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateSupabaseEnv } from '@/lib/supabase/config'
import { getSupabaseUrlForServer } from '@/lib/supabase/runtime-url'

export async function createClient() {
  const cookieStore = await cookies()
  const { isConfigured, key, reason } = validateSupabaseEnv()

  if (!isConfigured) {
    const message = `Supabase server client unavailable: ${reason ?? 'invalid configuration'}`
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message } }),
        exchangeCodeForSession: async () => ({ data: { user: null }, error: { message } }),
      },
      from: () => ({
        upsert: async () => ({ error: { message } }),
      }),
    } as unknown as ReturnType<typeof createServerClient>
  }

  return createServerClient(
    getSupabaseUrlForServer(),
    key!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
