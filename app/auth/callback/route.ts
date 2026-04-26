import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Exchanges the OAuth / PKCE `code` for a session and sets auth cookies.
 * (For static Android export, `route.static.ts` is swapped in by
 * `scripts/prepare-android-build.mjs` — do not use the stub for normal web dev.)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/'

  // Handle OAuth errors
  if (error) {
    const errorUrl = new URL(`${origin}/auth/auth-code-error`)
    errorUrl.searchParams.set('error', error)
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    return NextResponse.redirect(errorUrl.toString())
  }

  // Handle code exchange
  if (code) {
    const supabase = await createClient()
    const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError && data.user) {
      // Sync profile with OAuth user metadata (name from Google/Apple)
      try {
        const oauthName = data.user.user_metadata?.name ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.display_name ||
          data.user.email?.split('@')[0] ||
          null

        if (oauthName) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              name: oauthName,
            }, { onConflict: 'id' })

          if (profileError) {
            console.error('Profile sync error:', profileError)
          }
        }
      } catch (syncError) {
        console.error('Failed to sync OAuth profile:', syncError)
        // Don't fail auth if profile sync fails
      }

      // Success - redirect to app
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      // Exchange error - redirect to error page with details
      const errorUrl = new URL(`${origin}/auth/auth-code-error`)
      errorUrl.searchParams.set('error', exchangeError?.name || 'exchange_error')
      errorUrl.searchParams.set('error_description', exchangeError?.message || 'Authentication failed')
      return NextResponse.redirect(errorUrl.toString())
    }
  }

  // No code provided - redirect to error page
  const errorUrl = new URL(`${origin}/auth/auth-code-error`)
  errorUrl.searchParams.set('error', 'no_code')
  errorUrl.searchParams.set('error_description', 'No verification code provided')
  return NextResponse.redirect(errorUrl.toString())
}
