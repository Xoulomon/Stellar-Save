/**
 * sw.js — Stellar Save Service Worker
 *
 * Handles:
 *  1. PWA caching (cache-first for static assets, network-first for API)
 *  2. Offline fallback page
 *  3. Background push events (Web Push API)
 *  4. Scheduled contribution reminder alarms via postMessage
 *  5. Notification click → focus/open app and navigate to group detail
 */

const CACHE_NAME = 'stellar-save-v1';
const STATIC_ASSETS = ['/', '/offline.html', '/manifest.json', '/vite.svg'];
const APP_ORIGIN = self.location.origin;

// ─── Install: pre-cache static shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: purge old caches, claim clients ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: caching strategies ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || !url.origin.startsWith(APP_ORIGIN.split('//')[0])) return;

  // API calls: network-first, no cache fallback (let app handle errors)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached shell or offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match('/offline.html'));
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
    )
  );
});

// ─── Push Event ──────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Contribution Reminder', body: event.data.text(), groupId: null };
  }

  const { title = 'Contribution Reminder', body = 'Your deadline is approaching', groupId } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: groupId ? `contribution-${groupId}` : 'contribution-reminder',
      data: { groupId, url: groupId ? `/groups/${groupId}` : '/dashboard' },
      requireInteraction: false,
    })
  );
});

// ─── Message Channel (client-side scheduling) ────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, groupId } = event.data;
    self.registration.showNotification(title ?? 'Contribution Reminder', {
      body: body ?? 'Your deadline is approaching',
      icon: '/vite.svg',
      badge: '/vite.svg',
      tag: groupId ? `contribution-${groupId}` : 'contribution-reminder',
      data: { groupId, url: groupId ? `/groups/${groupId}` : '/dashboard' },
      requireInteraction: false,
    });
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/dashboard';
  const fullUrl = `${APP_ORIGIN}${targetUrl}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(APP_ORIGIN) && 'focus' in client) {
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullUrl);
        }
      })
  );
});
