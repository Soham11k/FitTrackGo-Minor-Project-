"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { siteConfig } from "@/lib/data"

function AuthCodeErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking")
  const [message, setMessage] = useState("")
  const supabase = createClient()

  useEffect(() => {
    async function handleAuth() {
      const code = searchParams.get("code")
      const error = searchParams.get("error")
      const errorDescription = searchParams.get("error_description")
      const errorCode = searchParams.get("error_code")

      const decodedDescription = errorDescription
        ? (() => {
            try {
              return decodeURIComponent(errorDescription.replace(/\+/g, " "))
            } catch {
              return errorDescription.replace(/\+/g, " ")
            }
          })()
        : null

      if (error) {
        setStatus("error")
        const normalizedDesc = (decodedDescription ?? "").trim()
        const base = normalizedDesc || error || "Authentication failed"
        const pkceMissing =
          /PKCECodeVerifierMissing|pkce.*code verifier not found/i.test(
            `${error}${normalizedDesc}`
          )
        const otpStale =
          errorCode === "otp_expired" ||
          /\botp_expired\b/i.test(`${error}|${normalizedDesc}`) ||
          /invalid\s+or\s+has\s+expired/i.test(normalizedDesc)

        if (otpStale && !pkceMissing) {
          setMessage(
            `${base}\n\nThis usually means the confirmation link expired or was already used. Request a fresh link from the login screen and open it within a few minutes in the same browser where you started sign-in.\n\nDev tip: if you use \"next dev -H 0.0.0.0\", browse at http://localhost:3000 (not 0.0.0.0) so magic links and cookies share one origin — and ensure that exact localhost URL is in Supabase Authentication → URL configuration → Redirect URLs.`
          )
          return
        }

        setMessage(
          pkceMissing
            ? `${base}\n\nTip: Use the confirmation link on the same device and browser where you started sign-up or sign-in. In Supabase → Authentication → URL configuration, ensure your redirect URLs include the exact origin you use locally (including http://0.0.0.0:PORT vs http://localhost:PORT if you mix them).`
            : base
        )
        return
      }

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            setStatus("error")
            const pkceMissing =
              /PKCECodeVerifierMissing|pkce.*code verifier not found/i.test(
                `${exchangeError.name ?? ""}${exchangeError.message ?? ""}`
              )
            setMessage(
              pkceMissing
                ? `${exchangeError.message || "Failed to verify email"}\n\nTip: Open the confirmation link in the same browser where you requested it, or request a new verification email.`
                : exchangeError.message || "Failed to verify email"
            )
          } else {
            setStatus("success")
            setMessage("Email verified successfully! Redirecting...")
            setTimeout(() => {
              router.push("/")
            }, 2000)
          }
        } catch (err: unknown) {
          setStatus("error")
          setMessage(err instanceof Error ? err.message : "An error occurred")
        }
      } else {
        setStatus("error")
        setMessage("No verification code provided")
      }
    }

    handleAuth()
  }, [searchParams, supabase, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-center">
          {status === "checking" && <Loader2 className="h-12 w-12 text-primary animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-12 w-12 text-chart-2" />}
          {status === "error" && <AlertCircle className="h-12 w-12 text-destructive" />}
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">
            {status === "checking" && "Verifying..."}
            {status === "success" && "Email Verified!"}
            {status === "error" && "Verification Failed"}
          </h1>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{message}</p>
        </div>

        {status === "error" && (
          <div className="space-y-3 pt-4">
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Home
            </button>
            <button
              onClick={() => router.push("/?resend=true")}
              className="w-full rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary/80"
            >
              Try Signing In Again
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="text-center pt-4">
            <p className="text-xs text-muted-foreground">Taking you to {siteConfig.appName}...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    }>
      <AuthCodeErrorContent />
    </Suspense>
  )
}
