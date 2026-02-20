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

      if (error) {
        setStatus("error")
        setMessage(errorDescription || error || "Authentication failed")
        return
      }

      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            setStatus("error")
            setMessage(exchangeError.message || "Failed to verify email")
          } else {
            setStatus("success")
            setMessage("Email verified successfully! Redirecting...")
            setTimeout(() => {
              router.push("/")
            }, 2000)
          }
        } catch (err: any) {
          setStatus("error")
          setMessage(err.message || "An error occurred")
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
          <p className="text-sm text-muted-foreground">{message}</p>
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
