/**
 * Vitest global test setup.
 *
 * Runs once before all test files. Extends expect with custom matchers and
 * configures the MSW Node server so all fetch calls are intercepted by
 * default handlers during the test run.
 */

import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

import { server } from '../__mocks__/msw/server';

// ── Custom matchers ───────────────────────────────────────────────────────────

expect.extend(toHaveNoViolations);

// ── MSW server lifecycle ──────────────────────────────────────────────────────

/**
 * Start the server before all tests.
 *
 * `onUnhandledRequest: 'warn'` prints a warning for any fetch that doesn't
 * match a registered handler, making it easy to spot missing handlers without
 * failing the test outright.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

/**
 * Reset handlers after each test so that per-test `server.use(...)` overrides
 * don't bleed into subsequent tests.
 */
afterEach(() => {
  server.resetHandlers();
});

/**
 * Close the server after all tests to free the underlying resources.
 */
afterAll(() => {
  server.close();
});
