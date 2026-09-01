/**
 * MSW Node test server — used in Vitest (jsdom) unit and integration tests.
 *
 * Import `server` from this file in test files that need to override
 * specific handlers for a test or describe block.
 *
 * The server is automatically started / reset / stopped by the global
 * test setup in `src/test/setup.ts` — you do NOT need to call
 * `server.listen()` or `server.close()` in individual test files.
 *
 * @example — Override a handler for a single test
 * ```ts
 * import { server } from '../__mocks__/msw/server';
 * import { http, HttpResponse } from 'msw';
 *
 * it('handles a 500 error gracefully', async () => {
 *   server.use(
 *     http.get('/api/groups', () =>
 *       HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 })
 *     )
 *   );
 *   // … render and assert
 * });
 * ```
 *
 * @example — Override a Horizon endpoint
 * ```ts
 * import { server } from '../__mocks__/msw/server';
 * import { http, HttpResponse } from 'msw';
 *
 * it('shows empty state when no payments exist', async () => {
 *   server.use(
 *     http.get('https://horizon-testnet.stellar.org/accounts/:id/payments', () =>
 *       HttpResponse.json({ _embedded: { records: [] } })
 *     )
 *   );
 *   // … render and assert
 * });
 * ```
 *
 * @see docs/msw-handlers.md for the full handler-adding convention.
 */

import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * Singleton MSW Node server.
 *
 * Started with `{ onUnhandledRequest: 'warn' }` so that unexpected network
 * calls appear as console warnings during tests rather than silently
 * succeeding or failing in confusing ways.
 */
export const server = setupServer(...handlers);
