import { NextResponse } from "next/server"
import { syncOAuthProfileToRow } from '@/lib/supabase/sync-oauth-profile'
import { createClient } from '@/lib/supabase/server'

function safeRelativeNext(raw: string | null): string {
  const n = (raw ?? '/').trim()
  if (!n.startsWith('/') || n.startsWith('//')) return '/'
  return n
}

function baseOriginForRedirect(request: Request): string {
  const { origin } = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (process.env.NODE_ENV === 'development') return origin
  if (forwardedHost) return `https://${forwardedHost}`
  return origin
}

/**
 * Some Supabase redirects put `error` / `code` only in `location.hash` (fragment never
 * reaches the server). Minimal HTML parses the hash and redirects to the right UI.
 */
function authCallbackFragmentBootstrapPage(originBase: string, nextPath: string): string {
  const cfg = JSON.stringify({ originBase, nextPath })
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Finishing sign-in…</title></head><body style="margin:2rem;font-family:system-ui,sans-serif;text-align:center"><p style="margin:2rem auto;max-width:20rem;line-height:1.5">Continuing sign-in…</p></body><script>var CFG=${cfg};
(function(){var h=typeof location.hash==="string"?location.hash.replace(/^#/,""):"";if(!h){location.replace(CFG.originBase+"/auth/auth-code-error?"+new URLSearchParams({error:"no_code",error_description:"No verification code provided"}));return;}var fh;try{fh=new URLSearchParams(h)}catch(e){fh=new URLSearchParams}var er=fh.get("error"),co=fh.get("code");if(er){fh.delete("provider_refresh_token");fh.delete("provider_token");fh.delete("access_token");fh.delete("refresh_token");fh.delete("token_type");location.replace(CFG.originBase+"/auth/auth-code-error?"+fh.toString());return}if(co){var u=new URL(CFG.originBase+"/auth/complete-session");u.searchParams.set("code",co);if(CFG.nextPath&&CFG.nextPath!=="/")u.searchParams.set("next",CFG.nextPath);location.replace(u.toString());return}location.replace(CFG.originBase+"/auth/auth-code-error?"+new URLSearchParams({error:"no_code",error_description:"No verification code in link"}))})()</script></html>`
}

/**
 * OAuth / email confirmation hits this URL first. PKCE verifier lives in cookies
 * set by the browser `createBrowserClient` — exchanging on the server often
 * yields `AuthPKCECodeVerifierMissingError`. Hand off to a client page to run
 * `exchangeCodeForSession` in-browser (see `/auth/complete-session`).
 *
 * Static Android export swaps this file via `scripts/prepare-android-build.mjs`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const { searchParams, origin } = url
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const next = safeRelativeNext(searchParams.get('next'))

  if (error) {
    const errorUrl = new URL(`${origin}/auth/auth-code-error`)
    errorUrl.searchParams.set('error', error)
    if (errorDescription) {
      errorUrl.searchParams.set('error_description', errorDescription)
    }
    const errorCode = searchParams.get('error_code')
    if (errorCode) {
      errorUrl.searchParams.set('error_code', errorCode)
    }
    return NextResponse.redirect(errorUrl.toString())
  }

  // Hand off PKCE completion to browser (see module doc comment).
  if (code) {
    const baseOrigin = baseOriginForRedirect(request)
    const resume = new URL(`${baseOrigin}/auth/complete-session`)
    resume.searchParams.set('code', code)
    if (next && next !== '/') resume.searchParams.set('next', next)
    return NextResponse.redirect(resume.toString())
  }

  // Server fallback: callbacks that already set session cookies (non-PKCE / edge flows).
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      try {
        await syncOAuthProfileToRow(supabase, user)
      } catch {
        /* non-fatal */
      }
      return NextResponse.redirect(`${baseOriginForRedirect(request)}${next}`)
    }
  } catch {
    /* fall through */
  }

  /**
   * No ?code | ?error in query — OAuth may still have sent data after `#` only.
   * Avoid an immediate misleading `no_code` redirect before the client reads the hash.
   */
  const html = authCallbackFragmentBootstrapPage(origin, next)
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
