/* ─────────────────────────────────────────────────────────
   Barber Zac ERP — Firebase Messaging Service Worker
   Handles background push notifications via FCM
   Fetches Firebase config from /api/firebase-config at activation
   ───────────────────────────────────────────────────────── */
/* eslint-disable no-undef */

// Import Firebase messaging scripts (compat for SW environment)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase will be initialized after config is fetched
let messagingInitialized = false;

// ── Fetch Firebase config from the API route and initialize ──
async function initializeFirebase() {
  if (messagingInitialized) return true;

  try {
    const response = await fetch('/api/firebase-config');
    if (!response.ok) {
      console.warn('[FCM-SW] Failed to fetch Firebase config:', response.status);
      return false;
    }

    const config = await response.json();

    if (!config.apiKey || !config.projectId || !config.messagingSenderId) {
      console.warn('[FCM-SW] Firebase config incomplete — skipping initialization');
      return false;
    }

    firebase.initializeApp(config);

    const messaging = firebase.messaging();

    // ── Handle background messages ──
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

      self.registration.showNotification(title, options);
    });

    messagingInitialized = true;
    console.log('[FCM-SW] Firebase initialized successfully');
    return true;
  } catch (err) {
    console.warn('[FCM-SW] Failed to initialize Firebase:', err);
    return false;
  }
}

// ── Initialize on activation ──
self.addEventListener('activate', function(event) {
  event.waitUntil(initializeFirebase());
});

// ── Initialize on install (in case activate already fired) ──
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// ── Handle notification click ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var url = event.notification.data?.url || '/';
  var fullUrl = self.location.origin + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Try to focus existing tab
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
      // No existing tab — open new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// ── Fallback: raw push event (when FCM messaging didn't handle it) ──
self.addEventListener('push', function(event) {
  // If Firebase messaging already initialized, it handles its own push events.
  // This fallback handles non-FCM push or cases where Firebase failed to init.
  if (messagingInitialized) return;

  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      data = { body: event.data ? event.data.text() : '' };
    } catch (e2) {
      data = {};
    }
  }

  var title = data.title || data.notification?.title || 'Barber Zac';
  var options = {
    body: data.body || data.notification?.body || '',
    icon: data.icon || '/icons/ibz-192.png',
    badge: '/icons/ibz-192.png',
    tag: data.tag || 'barber-zac-push',
    data: data.data || { url: '/' },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
