"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { invalidateSupabaseBrowserClient } from "@/lib/supabase/client"
import { primeSupabaseDevFromDiag } from "@/lib/supabase/dev-reachability"

const DISMISS_KEY = "ft-supabase-connectivity-dismissed"

/** Dev-only: surfaces /api/diag/supabase-proxy when sign-in cannot reach Supabase. */
export function SupabaseConnectivityBanner() {
  const [hint, setHint] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [checking, setChecking] = useState(false)

  const runDiag = useCallback(async () => {
    if (process.env.NODE_ENV !== "development") return
    setChecking(true)
    try {
      const j = await primeSupabaseDevFromDiag()
      if (!j) {
        setHint("Cannot load connectivity diagnostics. Is `npm run dev` running?")
        return
      }
      if (j.authReachable) {
        invalidateSupabaseBrowserClient()
        setHint(null)
        setDismissed(false)
        try {
          localStorage.removeItem(DISMISS_KEY)
        } catch {
          /* noop */
        }
        return
      }
      const envOk = (j as { configured?: boolean }).configured === true
      const host = j.serverHostname ?? "project host"
      setHint(
        envOk
          ? `Cloud sign-in is offline (${host} — connection reset). Your .env is fine. Tap the guest button below (not this text), or restart the project in Supabase.`
          : `Cannot reach Supabase (${host}). Check .env.local and restart the dev server.`
      )
    } catch {
      setHint("Cannot load connectivity diagnostics.")
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") setDismissed(true)
    } catch {
      /* noop */
    }
    void runDiag()
  }, [runDiag])

  if (!hint || dismissed) return null

  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-left text-xs leading-relaxed text-destructive"
    >
      <div className="flex gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="flex-1">{hint}</span>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            try {
              localStorage.setItem(DISMISS_KEY, "1")
            } catch {
              /* noop */
            }
          }}
          className="shrink-0 rounded p-0.5 text-destructive/80 hover:text-destructive"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex gap-2 pl-6">
        <button
          type="button"
          disabled={checking}
          onClick={() => void runDiag()}
          className="text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50"
        >
          {checking ? "Checking…" : "Check again"}
        </button>
      </div>
    </div>
  )
}
