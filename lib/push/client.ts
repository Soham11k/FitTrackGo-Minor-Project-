/**
 * Browser-side helpers for Web Push subscription.
 * Calls into `/api/push/subscribe` once the user has granted notification
 * permission.
 */

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export async function ensurePermission(): Promise<NotificationPermission> {
  if (!(await isPushSupported())) return "denied"
  if (Notification.permission === "granted") return "granted"
  if (Notification.permission === "denied") return "denied"
  return Notification.requestPermission()
}

export async function subscribeToPush(): Promise<boolean> {
  if (!(await isPushSupported())) return false
  const perm = await ensurePermission()
  if (perm !== "granted") return false

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return false

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  })
  return res.ok
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!(await isPushSupported())) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return true
  try {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: "DELETE",
    })
    return true
  } catch {
    return false
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
