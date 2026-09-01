/**
 * Barrel re-export for all MSW handler groups.
 *
 * Import from this file when you need the full combined handler set:
 *
 *   import { handlers } from '../__mocks__/msw/handlers';
 *
 * Or import individual handler factories for targeted overrides in tests:
 *
 *   import { createHorizonHandlers } from '../__mocks__/msw/handlers/horizon';
 *   import { createBackendHandlers } from '../__mocks__/msw/handlers/backend';
 *   import { createGraphQLHandlers } from '../__mocks__/msw/handlers/graphql';
 *
 * @see docs/msw-handlers.md for the full handler-adding convention.
 */

import { createBackendHandlers } from './backend';
import { createGraphQLHandlers } from './graphql';
import { createHorizonHandlers } from './horizon';

export { createBackendHandlers } from './backend';
export { createGraphQLHandlers } from './graphql';
export { createHorizonHandlers } from './horizon';

// Named re-exports of fixtures for use in test assertions
export * from './backend';
export * from './graphql';
export * from './horizon';

/**
 * The full combined handler list used by the test server.
 *
 * Order matters: MSW matches handlers from top to bottom, so more specific
 * handlers (e.g., per-test `server.use(...)`) should be added first.
 * Backend handlers are listed before Horizon handlers so that generic
 * `/api/*` routes don't shadow more specific ones.
 */
export const handlers = [
  ...createBackendHandlers(),
  ...createGraphQLHandlers(),
  ...createHorizonHandlers(),
];
