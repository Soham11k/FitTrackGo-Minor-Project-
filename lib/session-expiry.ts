/**
 * Centralized handling of "your session expired" UX so no component invents
 * its own redirect. Components call `handleSessionExpired()` when they see
 * a Supabase auth error; we show one toast and navigate to the sign-in flow.
 */
import { toast } from "sonner"
import { captureMessage } from "@/lib/sentry"

let dispatched = false
let dispatchedAt = 0

export function isSessionExpiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { message?: string; status?: number; code?: string }
  const msg = (e.message || "").toLowerCase()
  return (
    e.status === 401 ||
    e.code === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid refresh token") ||
    msg.includes("session_not_found") ||
    msg.includes("auth session missing")
  )
}

/**
 * Idempotent: only one toast + redirect per 5s window even if many callers
 * hit the same expiry simultaneously.
 */
export function handleSessionExpired(reason?: string) {
  const now = Date.now()
  if (dispatched && now - dispatchedAt < 5_000) return
  dispatched = true
  dispatchedAt = now

  try {
    toast.error("Your session expired — please sign in again.")
    captureMessage(`session_expired${reason ? `:${reason}` : ""}`, "info")
  } catch {
    /* noop */
  }

  if (typeof window === "undefined") return

  // Reload the current path; the root `app/page.tsx` detects signed-out state
  // and renders the login screen. Avoids hard-coding a route here.
  setTimeout(() => {
    try {
      window.location.reload()
    } catch {
      /* noop */
    }
  }, 600)
}

export async function withSessionGuard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (isSessionExpiredError(err)) {
      handleSessionExpired("withSessionGuard")
    }
    throw err
  }
}
