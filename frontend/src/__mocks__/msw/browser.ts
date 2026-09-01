/**
 * MSW browser service worker setup — used by the Vite dev server and
 * Storybook to intercept fetch calls in the real browser during development.
 *
 * This file is intentionally NOT imported in test code.
 * Tests use `src/__mocks__/msw/server.ts` (Node environment) instead.
 *
 * To enable MSW in the dev server, add this to `src/main.tsx`:
 *
 * ```ts
 * if (import.meta.env.DEV && import.meta.env.VITE_MSW === 'true') {
 *   const { worker } = await import('./__mocks__/msw/browser');
 *   await worker.start({ onUnhandledRequest: 'bypass' });
 * }
 * ```
 *
 * Then set `VITE_MSW=true` in your `.env.local` file and make sure
 * `public/mockServiceWorker.js` is present (run `npx msw init public/`).
 *
 * @see https://mswjs.io/docs/integrations/browser
 * @see docs/msw-handlers.md for the handler-adding convention.
 */

import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * MSW browser worker instance.
 *
 * Configured with `onUnhandledRequest: 'bypass'` so that unmatched requests
 * (e.g. Vite HMR websockets) pass through without warnings in the browser.
 */
export const worker = setupWorker(...handlers);
