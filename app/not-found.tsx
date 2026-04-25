"use client"

import Link from "next/link"
import { Home, ArrowLeft } from "lucide-react"
import { useLocale } from "@/components/locale-provider"

export default function NotFound() {
  const { t } = useLocale()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1
          className="text-7xl font-bold text-primary"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          404
        </h1>
        <div className="space-y-2">
          <h2
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {t("notFound.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("notFound.description")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
          >
            <Home className="h-4 w-4" />
            {t("notFound.goHome")}
          </Link>
          <button
            type="button"
            onClick={() => typeof window !== "undefined" && window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("notFound.goBack")}
          </button>
        </div>
      </div>
    </div>
  )
}
