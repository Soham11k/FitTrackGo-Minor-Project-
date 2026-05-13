/* FitTrack Go SW — push + offline shell (PR C1). */
const CACHE = "fittrackgo-shell-v1";
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.destination !== "document") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

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
