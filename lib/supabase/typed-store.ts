/**
 * Typed Supabase clients, parameterized by the Database schema in
 * `./database.types`. New code should prefer these over the untyped
 * `createClient()` in `./client.ts` so TS can catch column typos, missing
 * NOT NULLs on insert, etc.
 *
 * Existing call sites in `lib/store-supabase.ts` will be migrated
 * incrementally. Changing the signature of `createClient` would churn the
 * whole codebase, so we expose these as additive helpers instead.
 */

import { createBrowserClient, createServerClient, type CookieOptions } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { validateSupabaseEnv } from "@/lib/supabase/config"
import { getSupabaseUrlForRuntime, getSupabaseUrlForServer } from "@/lib/supabase/runtime-url"
import type { Database } from "./database.types"

export type TypedSupabaseClient = SupabaseClient<Database>

/**
 * Typed browser client. Returns null if env is not configured so callers can
 * render the "Supabase setup" state instead of throwing at module load.
 */
export function createTypedBrowserClient(): TypedSupabaseClient | null {
  const { isConfigured, key } = validateSupabaseEnv()
  if (!isConfigured || !key) return null
  return createBrowserClient<Database>(getSupabaseUrlForRuntime(), key)
}

type CookieStore = {
  get(name: string): { value: string } | undefined
  set?(name: string, value: string, options: CookieOptions): void
  remove?(name: string, options: CookieOptions): void
}

/**
 * Typed server client. Pass a cookie adapter (from Next's `cookies()` or a
 * Route Handler's `NextRequest`). Keeps the caller in charge of whether
 * set/remove are no-ops (read-only contexts) or real writes.
 */
export function createTypedServerClient(cookies: CookieStore): TypedSupabaseClient | null {
  const { isConfigured, key } = validateSupabaseEnv()
  if (!isConfigured || !key) return null
  return createServerClient<Database>(getSupabaseUrlForServer(), key, {
    cookies: {
      get(name: string) {
        return cookies.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookies.set?.(name, value, options)
        } catch {
          /* read-only cookie store (e.g. Server Components) */
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookies.remove?.(name, options)
        } catch {
          /* read-only cookie store */
        }
      },
    },
  })
}
