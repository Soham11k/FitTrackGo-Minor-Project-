"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { syncOAuthProfileToRow } from "@/lib/supabase/sync-oauth-profile"
import { invalidateAuthUserCache } from "@/lib/store-supabase"

/**
 * Finishes OAuth / email-confirm PKCE in the browser. The verifier is stored by
 * `createBrowserClient` in cookies; exchanging here avoids server Route Handler
 * exchange missing the verifier (different cookie visibility / SSR timing).
 */
function CompleteSessionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [message, setMessage] = useState("Signing you in…")

  useEffect(() => {
    let cancelled = false

    async function run() {
      const code = searchParams.get("code")
      const rawNext = searchParams.get("next")
      const next =
        rawNext?.trim().startsWith("/") && !rawNext.trim().startsWith("//") ? rawNext.trim() : "/"

      if (!code) {
        const u = new URL("/auth/auth-code-error", window.location.origin)
        u.searchParams.set("error", "no_code")
        u.searchParams.set("error_description", "Missing authorization code.")
        router.replace(u.toString())
        return
      }

      try {
        const supabase = createClient()
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError || !data.session) {
          const u = new URL("/auth/auth-code-error", window.location.origin)
          u.searchParams.set("error", exchangeError?.name ?? "exchange_error")
          u.searchParams.set("error_description", exchangeError?.message ?? "Authentication failed")
          router.replace(u.toString())
          return
        }

        invalidateAuthUserCache()

        try {
          if (data.user) await syncOAuthProfileToRow(supabase, data.user)
        } catch (syncErr) {
          console.error("Failed to sync OAuth profile:", syncErr)
        }

        if (!cancelled) setMessage("Welcome back — redirecting…")
        router.replace(next)
        router.refresh()
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unexpected error during sign-in"
        const u = new URL("/auth/auth-code-error", window.location.origin)
        u.searchParams.set("error", "unexpected")
        u.searchParams.set("error_description", msg)
        router.replace(u.toString())
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export default function CompleteSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        </div>
      }
    >
      <CompleteSessionContent />
    </Suspense>
  )
}
