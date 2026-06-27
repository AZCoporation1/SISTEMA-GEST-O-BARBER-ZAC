/* ─────────────────────────────────────────────────────────
   Barber Zac ERP — Unified Service Worker
   Combines Workbox (caching/offline) + Firebase Cloud Messaging (push)
   ───────────────────────────────────────────────────────── */
/* eslint-disable no-undef */
self.__SUPABASE_REST__ = self.__SUPABASE_REST__ || "";
self.__SCOREBOT_URL__  = self.__SCOREBOT_URL__  || "";

// ── Firebase Messaging ──────────────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Workbox ─────────────────────────────────────────────────────
importScripts("https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js");
workbox.setConfig({ debug: false });

self.skipWaiting();
workbox.core.clientsClaim();

// ═══════════════════════════════════════════════════════════
// SECTION 1: FIREBASE CLOUD MESSAGING (Push Notifications)
// ═══════════════════════════════════════════════════════════

let firebaseInitialized = false;

async function initializeFirebase() {
  if (firebaseInitialized) return true;

  try {
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      console.warn('[SW] Failed to fetch Firebase config:', response.status);
      return false;
    }

    const config = await response.json();

    if (!config.apiKey || !config.projectId || !config.messagingSenderId) {
      console.warn('[SW] Firebase config incomplete');
      return false;
    }

    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Handle background push messages from FCM
    messaging.onBackgroundMessage(function(payload) {
      var notifData = payload.notification || {};
      var data = payload.data || {};

      var title = notifData.title || data.title || 'Barber Zac';
      var options = {
        body: notifData.body || data.body || '',
        icon: notifData.icon || data.icon || '/icons/ibz-192.png',
        badge: '/icons/ibz-192.png',
        tag: data.tag || data.eventType || 'barber-zac',
        renotify: true,
        requireInteraction: false,
        data: {
          url: data.url || '/',
          eventType: data.eventType || '',
          entityId: data.entityId || '',
        },
      };

      return self.registration.showNotification(title, options);
    });

    firebaseInitialized = true;
    console.log('[SW] Firebase Messaging initialized');
    return true;
  } catch (err) {
    console.warn('[SW] Firebase init failed:', err);
    return false;
  }
}

// ── Notification click handler ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = event.notification.data?.url || '/';
  var fullUrl = self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(url);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// ── Fallback push handler (when Firebase SDK didn't handle it) ──
self.addEventListener('push', function(event) {
  // If Firebase messaging handled this push, it won't reach here.
  // This fallback covers non-FCM push or failed Firebase init.
  if (firebaseInitialized) {
    // Firebase SDK should handle it via onBackgroundMessage.
    // But on iOS Safari, it sometimes doesn't — show notification as safety net.
    var data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      try { data = { body: event.data ? event.data.text() : '' }; } catch (e2) { data = {}; }
    }

    // Only show if there's actual notification content
    var notif = data.notification || {};
    var pushData = data.data || {};
    var title = notif.title || pushData.title;
    if (title) {
      event.waitUntil(
        self.registration.showNotification(title, {
          body: notif.body || pushData.body || '',
          icon: notif.icon || '/icons/ibz-192.png',
          badge: '/icons/ibz-192.png',
          tag: pushData.tag || 'barber-zac',
          renotify: true,
          data: { url: pushData.url || '/' },
        })
      );
    }
    return;
  }

  // Full fallback when Firebase not initialized
  var rawData = {};
  try {
    rawData = event.data ? event.data.json() : {};
  } catch (e) {
    try { rawData = { body: event.data ? event.data.text() : '' }; } catch (e2) { rawData = {}; }
  }

  var fallbackTitle = rawData.title || rawData.notification?.title || 'Barber Zac';
  var fallbackOptions = {
    body: rawData.body || rawData.notification?.body || '',
    icon: rawData.icon || '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: rawData.tag || 'barber-zac-push',
    data: rawData.data || { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(fallbackTitle, fallbackOptions)
  );
});

// ═══════════════════════════════════════════════════════════
// SECTION 2: WORKBOX (Caching & Offline Support)
// ═══════════════════════════════════════════════════════════

var OFFLINE_URL = "/offline.html";

// Cache version — increment on deploy to force cleanup of stale caches
var CACHE_VERSION = "v3";
var EXPECTED_CACHES = [
  "html-pages-" + CACHE_VERSION,
  "static-" + CACHE_VERSION,
  "images",
  "offline-fallback"
];

// HTML navigation
workbox.routing.registerRoute(
  function(params) { return params.request.mode === "navigate"; },
  new workbox.strategies.NetworkFirst({
    cacheName: "html-pages-" + CACHE_VERSION,
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      new workbox.expiration.ExpirationPlugin({ maxEntries: 25, purgeOnQuotaError: true })
    ]
  })
);

// Static assets
workbox.routing.registerRoute(
  function(params) { return ["script","style","worker"].includes(params.request.destination); },
  new workbox.strategies.StaleWhileRevalidate({ cacheName: "static-" + CACHE_VERSION })
);

// Images
workbox.routing.registerRoute(
  function(params) { return params.request.destination === "image"; },
  new workbox.strategies.CacheFirst({
    cacheName: "images",
    plugins: [ new workbox.expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60*60*24*30 }) ]
  })
);

// [PERF] Supabase REST cache REMOVED — ERP financial data must always be fresh.
// Previously used StaleWhileRevalidate with 5min TTL, causing stale data after sales.

// Background Sync for ScoreBot
if (self.__SCOREBOT_URL__) {
  var bgSync = new workbox.backgroundSync.BackgroundSyncPlugin("scorebot-queue", { maxRetentionTime: 24 * 60 });
  var scorebotMatcher = new RegExp("^" + self.__SCOREBOT_URL__.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  workbox.routing.registerRoute(
    function(params) { return params.request.method === "POST" && scorebotMatcher.test(params.url.href); },
    new workbox.strategies.NetworkOnly({ plugins: [bgSync] }),
    "POST"
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION 3: LIFECYCLE
// ═══════════════════════════════════════════════════════════

// Force update
self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Offline fallback
self.addEventListener("fetch", function(event) {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function() { return caches.match(OFFLINE_URL); })
    );
  }
});

// Pre-cache offline page + init Firebase on install
self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open("offline-fallback").then(function(cache) { return cache.add(OFFLINE_URL); })
  );
});

// Initialize Firebase + clean old caches on activate
self.addEventListener("activate", function(event) {
  event.waitUntil(
    Promise.all([
      initializeFirebase(),
      // Clean up old cache versions and removed caches (e.g. supabase-rest)
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.filter(function(name) {
            return EXPECTED_CACHES.indexOf(name) === -1;
          }).map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
        );
      })
    ])
  );
});
