/**
 * sw.js — Stellar Save Service Worker
 *
 * Handles:
 *  1. PWA caching (cache-first for static assets, network-first for API)
 *  2. Offline fallback page
 *  3. Background push events (Web Push API)
 *  4. Scheduled contribution reminder alarms via postMessage
 *  5. Notification click → focus/open app and navigate to group detail
 *  6. Background sync for offline actions
 */

const CACHE_NAME = 'stellar-save-v2';
const STATIC_ASSETS = ['/', '/offline.html', '/manifest.json', '/vite.svg'];
const APP_ORIGIN = self.location.origin;
const API_CACHE = 'stellar-save-api-v2';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cap the runtime cache so it cannot grow without bound.
const RUNTIME_MAX_ENTRIES = 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Trim a cache to at most `maxEntries`, evicting oldest entries first (FIFO). */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // keys() preserves insertion order; delete from the front.
  for (let i = 0; i < keys.length - maxEntries; i += 1) {
    await cache.delete(keys[i]);
  }
}

/** Notify all controlled clients that a new SW version is now active. */
async function notifyClientsOfUpdate() {
  const clientList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clientList) {
    client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION });
  }
}

// ─── Install: pre-cache static shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: purge ALL stale caches, claim clients, notify of update ────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => notifyClientsOfUpdate())
  );
});

// ─── Fetch: caching strategies ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== APP_ORIGIN) return;

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then((cache) =>
        fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              // Add timestamp header for cache expiration
              const headers = new Headers(responseClone.headers);
              headers.set('X-Cache-Time', Date.now().toString());
              const cachedResponse = new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers,
              });
              cache.put(request, cachedResponse);
            }
            return response;
          })
          .catch(async () => {
            // Try cache on network failure
            const cached = await cache.match(request);
            if (cached) {
              // Check if cache is still fresh
              const cacheTime = cached.headers.get('X-Cache-Time');
              if (cacheTime) {
                const age = Date.now() - parseInt(cacheTime, 10);
                if (age < API_CACHE_DURATION) {
                  return cached;
                }
              }
              // Return stale cache with warning header
              const headers = new Headers(cached.headers);
              headers.set('X-Cache-Stale', 'true');
              return new Response(cached.body, {
                status: cached.status,
                statusText: cached.statusText,
                headers,
              });
            }
            // No cache available
            return new Response(
              JSON.stringify({ error: 'offline', message: 'Network unavailable' }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          })
      )
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached shell or offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(async () => {
          // Read-only offline: serve the previously cached route, then the app
          // shell ('/'), then the dedicated offline page as a last resort.
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            (await caches.match('/offline.html'));
          return cached;
        })
    );
    return;
  }

  // Static assets: cache-first, populate the runtime cache and prune it.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          // Only cache successful, basic (same-origin) responses.
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => {
              c.put(request, clone).then(() => trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES));
            });
          }
          return res;
        })
    )
  );
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(
      // Notify all clients to trigger sync
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_REQUESTED' });
        });
      })
    );
  }
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

  if (event.data.type === 'SYNC_NOW') {
    // Register background sync
    self.registration.sync
      .register('sync-offline-actions')
      .then(() => {
        console.log('[SW] Background sync registered');
      })
      .catch((err) => {
        console.error('[SW] Background sync registration failed:', err);
      });
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
