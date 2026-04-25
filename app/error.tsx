"use client"

import { useEffect } from "react"
import { AlertCircle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useLocale()
  const isDev = process.env.NODE_ENV === "development"

  useEffect(() => {
    console.error("Application error:", error)
    const url = process.env.NEXT_PUBLIC_ERROR_REPORTING_URL || "/api/report-error"
    if (typeof fetch !== "function") return
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        name: error.name,
        stack: isDev ? error.stack : undefined,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [error, isDev])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {t("error.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("error.description")}
          </p>
        </div>

        {isDev && error.message && (
          <div className="rounded-lg bg-card border border-border p-4 text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t("error.details")}</p>
            <p className="text-sm text-foreground font-mono break-all">{error.message}</p>
          </div>
        )}
        {error.digest && (
          <p className="text-xs text-muted-foreground">{t("error.reference")} {error.digest}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={reset}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("error.tryAgain")}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            {t("error.goHome")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          {t("error.footerHint")}
        </p>
      </div>
    </div>
  )
}
