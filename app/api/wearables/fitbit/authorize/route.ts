import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { buildFitbitAuthorizeUrl, getFitbitCallbackUrl, isFitbitConfigured } from "@/lib/wearables/fitbit"

const STATE_COOKIE = "fitbit_oauth_state"

export async function GET() {
  if (!isFitbitConfigured()) {
    return NextResponse.redirect(new URL("/?fitbit_setup=server", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
  }

  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.redirect(new URL("/?fitbit_setup=signin", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"))
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
