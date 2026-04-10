/* IBZ Score - Service Worker (Workbox) */
/* eslint-disable no-undef */
self.__SUPABASE_REST__ = self.__SUPABASE_REST__ || "";
self.__SCOREBOT_URL__  = self.__SCOREBOT_URL__  || "";

importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");
workbox.setConfig({ debug: false });
self.skipWaiting();
workbox.core.clientsClaim();

const OFFLINE_URL = "/offline.html";

// HTML navigation
workbox.routing.registerRoute(
  ({request}) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({
    cacheName: "html-pages",
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      new workbox.expiration.ExpirationPlugin({ maxEntries: 25, purgeOnQuotaError: true })
    ]
  })
);

// Static assets
workbox.routing.registerRoute(
  ({request}) => ["script","style","worker"].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({ cacheName: "static" })
);

// Images (Cache robusto)
workbox.routing.registerRoute(
  ({request}) => request.destination === "image",
  new workbox.strategies.CacheFirst({
    cacheName: "images",
    plugins: [ new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60*60*24*30 }) ]
  })
);

// Supabase REST GETs (rank, score, eventos)
if (self.__SUPABASE_REST__) {
  const supabaseMatcher = new RegExp("^" + self.__SUPABASE_REST__.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  workbox.routing.registerRoute(
    ({url, request}) => request.method === "GET" && supabaseMatcher.test(url.href),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: "supabase-rest",
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60*5 })
      ]
    })
  );
}

// Background Sync para POST do ScoreBot (fila 24h)
if (self.__SCOREBOT_URL__) {
  const bgSync = new workbox.backgroundSync.BackgroundSyncPlugin("scorebot-queue", { maxRetentionTime: 24 * 60 });
  const scorebotMatcher = new RegExp("^" + self.__SCOREBOT_URL__.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  workbox.routing.registerRoute(
    ({url, request}) => request.method === "POST" && scorebotMatcher.test(url.href),
    new workbox.strategies.NetworkOnly({ plugins: [bgSync] }),
    "POST"
  );
}

// Forçar update da SW
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Offline fallback
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});

// Pre-cache offline page on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("offline-fallback").then((cache) => cache.add(OFFLINE_URL))
  );
});
