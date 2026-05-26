/* FitTrack Go SW — push + offline shell (PR C1).
 * Caching impact: see docs/PERF.md (document navigations, /auth exception, precache list). */
const CACHE = "fittrackgo-shell-v2";
const SHELL = ["/offline", "/marketing", "/manifest.json", "/brand/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k.startsWith("fittrackgo-shell-"))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

/**
 * Avoid showing the dashboard “offline shell” during Supabase redirects:
 * navigations often fail transiently during dev/network blips — /offline is misleading.
 */
function authFallbackResponse(url) {
  const retry = encodeURI(url.pathname + url.search + url.hash);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Sign-in needs network</title></head><body style="margin:2rem;font-family:system-ui,sans-serif;max-width:28rem;line-height:1.45"><p><strong>This page needs a connection</strong> to finish signing in.</p><p>Open the confirmation link again when you&apos;re online, or use <a href="/">Retry from home</a>.</p><p style="margin-top:1.25rem;font-size:.9rem;"><a href="${retry.replace(/"/g, "&quot;")}">Retry same URL</a></p></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.destination !== "document") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Auth redirects must not degrade into the offline dashboard shell on fetch errors.
  if (url.pathname.startsWith("/auth")) {
    event.respondWith(fetch(req).catch(() => authFallbackResponse(url)));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match(req).catch(() => undefined);
        if (cached) return cached;
        return caches.match("/offline").catch(() => undefined);
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "FitTrackGo", body: "You've got a new update." };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        payload = { ...payload, ...parsed };
      }
    }
  } catch {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/brand/icon-192.png",
    badge: "/brand/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    }),
  );
});
