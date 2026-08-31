/**
 * serviceWorkerRegistration.ts
 *
 * Registers /sw.js and exposes a helper to post messages to it.
 * The SW must live at the root so it can control all app pages.
 */

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Registers the service worker. Safe to call multiple times — returns the
 * cached registration on subsequent calls.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers not supported in this browser.');
    return null;
  }

  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.info('[SW] Service worker registered:', swRegistration.scope);

    // Listen for messages from the SW (e.g. navigation requests, version updates)
    navigator.serviceWorker.addEventListener('message', handleSwMessage);

    // When a new SW is found, ask it to activate immediately once installed so
    // repeat visitors pick up the latest cached assets without a manual refresh.
    swRegistration.addEventListener('updatefound', () => {
      const installing = swRegistration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          // A previous SW controls the page → a new version is waiting.
          installing.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });

    // When the active SW changes, reload once so the new version controls the
    // page. Guarded to avoid reload loops.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });

    return swRegistration;
  } catch (err) {
    console.error('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Posts a message to the active service worker.
 * Waits for the SW to become active if it is still installing.
 */
export async function postToServiceWorker(message: Record<string, unknown>): Promise<void> {
  const reg = swRegistration ?? (await registerServiceWorker());
  if (!reg) return;

  const sw = reg.active ?? reg.waiting ?? reg.installing;
  if (!sw) {
    console.warn('[SW] No active service worker to post message to.');
    return;
  }

  sw.postMessage(message);
}

// ─── Internal: handle navigation messages from SW ────────────────────────────
// The SW sends { type: 'NAVIGATE', url } when a notification is clicked and
// an existing window is found. We use the History API to navigate in-place.
function handleSwMessage(event: MessageEvent): void {
  if (!event.data) return;

  // A new SW version activated and purged stale caches. The controllerchange
  // listener handles the reload; we just log here for observability.
  if (event.data.type === 'SW_UPDATED') {
    console.info('[SW] New version active:', event.data.version);
    return;
  }

  if (event.data.type !== 'NAVIGATE') return;

  const url: string = event.data.url;
  if (url && window.location.pathname !== url) {
    // React Router will pick this up via the BrowserRouter's history listener
    window.history.pushState({}, '', url);
    // Dispatch a popstate so React Router re-renders
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
