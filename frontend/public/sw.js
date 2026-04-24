/**
 * sw.js — Stellar Save Service Worker
 *
 * Handles:
 *  1. Background push events (Web Push API)
 *  2. Scheduled contribution reminder alarms via postMessage
 *  3. Notification click → focus/open app and navigate to group detail
 */

const APP_ORIGIN = self.location.origin;

// ─── Push Event ──────────────────────────────────────────────────────────────
// Fired when the browser receives a push message from the server.
// For client-side-only scheduling we skip the push server and use
// the message channel below instead, but this handler is required
// for full Web Push API compatibility.
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
// The app posts a message to the SW to trigger a notification immediately
// (after a setTimeout in the client fires). This lets us show notifications
// even when the tab is in the background.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;

  const { title, body, groupId } = event.data;

  self.registration.showNotification(title ?? 'Contribution Reminder', {
    body: body ?? 'Your deadline is approaching',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: groupId ? `contribution-${groupId}` : 'contribution-reminder',
    data: { groupId, url: groupId ? `/groups/${groupId}` : '/dashboard' },
    requireInteraction: false,
  });
});

// ─── Notification Click ───────────────────────────────────────────────────────
// 1. Close the notification.
// 2. Find an existing app window and focus it, or open a new one.
// 3. Navigate to the group detail page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/dashboard';
  const fullUrl = `${APP_ORIGIN}${targetUrl}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window on the same origin
        for (const client of clientList) {
          if (client.url.startsWith(APP_ORIGIN) && 'focus' in client) {
            // Tell the existing window to navigate
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return client.focus();
          }
        }
        // No existing window — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(fullUrl);
        }
      })
  );
});

// ─── Activate: claim clients immediately ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
