import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveCanonicalSupabaseOriginFromEnv } from '@/lib/supabase/runtime-url'

function isPlaceholderServiceRoleKey(key: string): boolean {
  const t = key.trim().toLowerCase()
  if (!t) return true
  if (t === 'your-service-role-key' || t === 'your-service-role-key-here') return true
  if (t.startsWith('your-')) return true
  return false
}

/** Server-only admin client. Returns null if URL/key missing or still set to example text. */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = resolveCanonicalSupabaseOriginFromEnv()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key || isPlaceholderServiceRoleKey(key)) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
