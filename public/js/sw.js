const CACHE = "autoservice-v1";
const ASSETS = [
  "/css/style.css",
  "/css/autoservice.css",
  "/js/app.js",
  "/icons/icon.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for static assets; network-first for everything else.
  const isAsset = /\.(css|js|svg|png|jpg|jpeg|webp|gif|webmanifest)$/.test(url.pathname);
  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached))
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
