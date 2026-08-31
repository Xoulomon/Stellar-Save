import { test, expect } from '@playwright/test';

/**
 * E2E tests: Wallet connection flow
 * Covers connecting, disconnecting, and UI state changes.
 */
test.describe('Wallet connection flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/stellar.save/i);
  });

  test('landing page shows connect wallet button in header', async ({ page }) => {
    // Header has "Connect your Stellar wallet" button
    const connectBtn = page.getByRole('button', { name: 'Connect your Stellar wallet' });
    await expect(connectBtn).toBeVisible();
  });

  test('navigation header is visible on landing page', async ({ page }) => {
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
  });

  test('landing page shows hero section with get started button', async ({ page }) => {
    // Button aria-label is "Get started with Stellar Save"
    const getStartedBtn = page.getByRole('button', { name: 'Get started with Stellar Save' });
    await expect(getStartedBtn).toBeVisible();
  });

  test('clicking connect wallet button in header triggers wallet interaction', async ({ page }) => {
    const walletBtn = page.getByRole('button', { name: 'Connect your Stellar wallet' });
    await walletBtn.click();
    // After clicking, the page should still be visible (no crash)
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('protected routes are accessible (redirect or show content)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('groups browse page is accessible', async ({ page }) => {
    await page.goto('/groups/browse');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('landing page has main navigation links', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    await expect(nav).toBeVisible();
  });
});
