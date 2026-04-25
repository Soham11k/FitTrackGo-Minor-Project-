/**
 * Server-side Web Push sender.
 *
 * Uses `web-push` when installed (`npm i web-push`); otherwise returns an
 * `unavailable` status so the sender falls back to logging. We dynamic-import
 * so production builds without the dep stay green.
 *
 * VAPID keys come from env:
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:support@...
 */

export interface PushSubscriptionJson {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
  icon?: string
}

export interface SendResult {
  ok: boolean
  status?: number
  error?: string
}

type WebPushModule = {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  sendNotification: (
    sub: PushSubscriptionJson,
    payload: string
  ) => Promise<{ statusCode: number; body: string; headers: Record<string, string> }>
}

let mod: WebPushModule | null = null
let loaded = false
let vapidSet = false

async function getWebPush(): Promise<WebPushModule | null> {
  if (loaded) return mod
  loaded = true
  try {
    const dynamicImport = Function("s", "return import(s)") as (
      s: string
    ) => Promise<WebPushModule>
    mod = await dynamicImport("web-push")
  } catch {
    mod = null
  }
  return mod
}

export async function sendPush(
  subscription: PushSubscriptionJson,
  payload: PushPayload
): Promise<SendResult> {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:support@example.com"

  const wp = await getWebPush()
  if (!wp || !publicKey || !privateKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[push] web-push unavailable — would have sent:", payload)
    }
    return { ok: false, error: "web-push not configured" }
  }

  if (!vapidSet) {
    wp.setVapidDetails(subject, publicKey, privateKey)
    vapidSet = true
  }

  try {
    const res = await wp.sendNotification(subscription, JSON.stringify(payload))
    return { ok: true, status: res.statusCode }
  } catch (err) {
    const anyErr = err as { statusCode?: number; body?: string; message?: string }
    return {
      ok: false,
      status: anyErr.statusCode,
      error: anyErr.body || anyErr.message || "push failed",
    }
  }
}
