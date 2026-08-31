import { test, expect, request as apiRequest } from '@playwright/test';

/**
 * Synthetic monitoring canaries for critical production journeys.
 * Run on a schedule against a live deployment — see docs/synthetic-monitoring.md.
 *
 * Set SIMULATE_FAILURE=1 to deliberately fail a check (used to verify alerting).
 * Set CANARY_CONTRACT_ID to the canary contract address for context in reports.
 * Set API_BASE_URL to the backend base URL (default: same origin as the page).
 */
const simulateFailure = process.env['SIMULATE_FAILURE'] === '1';
const canaryContractId = process.env['CANARY_CONTRACT_ID'] ?? '(not set)';
const apiBaseUrl = process.env['API_BASE_URL'] ?? '';

// ─── Frontend journeys ────────────────────────────────────────────────────────

test.describe('Synthetic: connect-wallet journey', () => {
  test('landing page loads and exposes the connect wallet action', async ({ page }) => {
    await page.goto(simulateFailure ? '/__synthetic-simulated-outage__' : '/');
    await expect(page).toHaveTitle(/stellar.save/i);
    const connectBtn = page.getByRole('button', { name: 'Connect your Stellar wallet' });
    await expect(connectBtn).toBeVisible();
  });
});

test.describe('Synthetic: view-groups journey', () => {
  test('browse groups page loads', async ({ page }) => {
    await page.goto('/groups/browse');
    await expect(page).toHaveTitle(/browse groups/i);
    await expect(page.locator('[aria-labelledby="browse-groups-heading"]')).toBeVisible();
  });
});

// ─── Canary gate: API health checks ──────────────────────────────────────────
/**
 * These tests run against the canary deployment's backend API before promotion.
 * They complement the shell smoke-test suite (scripts/canary_smoke_test.sh) with
 * a Playwright-native request context so they can run in the same CI job as the
 * frontend synthetic tests.
 *
 * Canary contract under test: set via CANARY_CONTRACT_ID env var.
 */
test.describe('Canary gate: API health checks', () => {
  // Log canary context at suite start
  test.beforeAll(() => {
    console.log(`[canary gate] contract: ${canaryContractId}`);
    console.log(`[canary gate] api base: ${apiBaseUrl || '(using page origin)'}`);
  });

  test('backend /health endpoint returns 200', async ({ page }) => {
    // Derive the API base from the page baseURL when not explicitly set
    const base = apiBaseUrl || (page.url().startsWith('http') ? new URL(page.url()).origin : '');
    test.skip(!base, 'API_BASE_URL not set and no page origin available — skipping');

    const ctx = await apiRequest.newContext({ baseURL: base });
    try {
      const res = await ctx.get('/health', { timeout: 10_000 });
      expect(
        res.status(),
        `Expected GET /health to return 200, got ${res.status()}`
      ).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  test('backend /api/groups returns 200 with JSON array', async ({ page }) => {
    const base = apiBaseUrl || (page.url().startsWith('http') ? new URL(page.url()).origin : '');
    test.skip(!base, 'API_BASE_URL not set and no page origin available — skipping');

    const ctx = await apiRequest.newContext({ baseURL: base });
    try {
      const res = await ctx.get('/api/groups', { timeout: 10_000 });
      expect(
        res.status(),
        `Expected GET /api/groups to return 200, got ${res.status()}`
      ).toBe(200);

      const contentType = res.headers()['content-type'] ?? '';
      expect(contentType, 'Response should be JSON').toMatch(/application\/json/);

      const body = await res.json();
      // Allow both array (list of groups) and object (paginated result)
      expect(
        Array.isArray(body) || (typeof body === 'object' && body !== null),
        'Response body should be an array or object'
      ).toBe(true);
    } finally {
      await ctx.dispose();
    }
  });

  test('simulate-failure mode triggers a detectable outage', async ({ page }) => {
    /**
     * This test only runs when SIMULATE_FAILURE=1.
     * Its purpose is to verify that the alerting pipeline correctly fires when
     * the smoke-test suite detects an outage. CI runs this with SIMULATE_FAILURE=1
     * in a dedicated "verify-alerting" job, not in the promotion gate.
     */
    test.skip(!simulateFailure, 'Only runs when SIMULATE_FAILURE=1');

    const res = await page.goto('/__synthetic-simulated-outage__');
    // Simulated outage endpoint should NOT return 200
    expect(res?.status() ?? 0).not.toBe(200);
  });
});
