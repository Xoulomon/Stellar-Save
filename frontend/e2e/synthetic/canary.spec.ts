import { test, expect } from '@playwright/test';

/**
 * Synthetic monitoring canaries for critical production journeys.
 * Run on a schedule against a live deployment — see docs/synthetic-monitoring.md.
 * Set SIMULATE_FAILURE=1 to deliberately fail a check (used to verify alerting).
 */
const simulateFailure = process.env['SIMULATE_FAILURE'] === '1';

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
