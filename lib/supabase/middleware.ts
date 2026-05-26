import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSupabaseFetchError, validateSupabaseEnv } from '@/lib/supabase/config'
import { shouldSkipSupabaseNetwork } from '@/lib/supabase/connectivity-circuit'
import { getSupabaseUrlForServer } from '@/lib/supabase/runtime-url'

export async function updateSession(request: NextRequest, _requestId?: string) {
  // Skip processing /login route - it doesn't exist and is handled client-side
  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const { isConfigured, key, reason } = validateSupabaseEnv()
  if (!isConfigured) {
    console.warn(`[supabase] Skipping proxy auth refresh: ${reason ?? 'invalid configuration'}`)
    return supabaseResponse
  }

  // Dev: client-side auth + mock/offline circuit — skip server refresh (avoids ECONNRESET spam when project is paused).
  if (process.env.NODE_ENV === 'development') {
    return supabaseResponse
  }

  const supabase = createServerClient(
    getSupabaseUrlForServer(),
    key!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  if (shouldSkipSupabaseNetwork()) {
    return supabaseResponse
  }

  // Refresh the session - this updates the cookies
  try {
    await supabase.auth.getUser()
  } catch (error) {
    if (isSupabaseFetchError(error)) {
      console.warn('[supabase] Session refresh skipped because Supabase is unreachable.')
      return supabaseResponse
    }
    throw error
  }

  // Note: We don't redirect here because the app uses client-side routing.
  // The client-side code in app/page.tsx handles showing the login screen
  // based on auth state. The proxy's job is just to refresh the session cookies.

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}
