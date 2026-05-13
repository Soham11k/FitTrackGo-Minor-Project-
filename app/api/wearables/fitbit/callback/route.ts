import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import {
  exchangeFitbitCode,
  fetchFitbitExternalUserId,
  getFitbitCallbackUrl,
  isFitbitConfigured,
} from "@/lib/wearables/fitbit"
import { persistTokens } from "@/lib/wearables/sync-fitbit"

const STATE_COOKIE = "fitbit_oauth_state"

function appOrigin(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (u) return u
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export async function GET(request: Request) {
  const origin = appOrigin()
  const fail = (code: string) => NextResponse.redirect(new URL(`/?fitbit_oauth=${code}`, origin))

  if (!isFitbitConfigured()) return fail("server")

  const url = new URL(request.url)
  const err = url.searchParams.get("error")
  if (err) return fail("denied")

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${STATE_COOKIE}=`))
    ?.slice(`${STATE_COOKIE}=`.length)

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("state")
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return fail("signin")

  const admin = createServiceRoleClient()
  if (!admin) return fail("server")

  const redirectUri = getFitbitCallbackUrl()
  let tokens
  try {
    tokens = await exchangeFitbitCode(code, redirectUri)
  } catch {
    return fail("token")
  }

  let externalId: string | null = null
  try {
    externalId = await fetchFitbitExternalUserId(tokens.access_token)
  } catch {
    /* optional */
  }

  try {
    await persistTokens(admin, user.id, tokens, externalId)
  } catch {
    return fail("db")
  }

  const res = NextResponse.redirect(new URL("/?fitbit_oauth=ok", origin))
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 })
  return res
}
