import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { buildFitbitAuthorizeUrl, getFitbitCallbackUrl, isFitbitConfigured } from "@/lib/wearables/fitbit"
import { resolveWearableOAuthRedirectBase } from "@/lib/wearables/app-origin"

const STATE_COOKIE = "fitbit_oauth_state"

export async function GET() {
  const appBase = resolveWearableOAuthRedirectBase()
  if (!isFitbitConfigured()) {
    return NextResponse.redirect(new URL("/?fitbit_setup=server", appBase))
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.redirect(new URL("/?fitbit_setup=signin", appBase))
  }

  const state = crypto.randomUUID()
  const redirectUri = getFitbitCallbackUrl()
  const url = buildFitbitAuthorizeUrl({ state, redirectUri })

  const res = NextResponse.redirect(url)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  })
  return res
}
