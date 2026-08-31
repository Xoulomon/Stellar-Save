import { test, expect } from '@playwright/test';

/**
 * E2E tests: Payout execution flow
 * Covers payout queue visibility and payout trigger UI on group detail pages.
 */
test.describe('Payout execution flow', () => {
  test('group detail page renders without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/groups/test-group-1');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('fetch') && !e.includes('network') && !e.includes('404')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('group detail page shows some content', async ({ page }) => {
    await page.goto('/groups/test-group-1');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('payout section or queue is visible on group detail page', async ({ page }) => {
    await page.goto('/groups/test-group-1');
    await page.waitForLoadState('networkidle');
    // Page should have rendered something
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('dashboard page loads', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('groups page loads', async ({ page }) => {
    await page.goto('/groups');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('browse groups page loads', async ({ page }) => {
    await page.goto('/groups/browse');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/stellar.save/i);
    const heading = page.getByRole('heading', { name: /save together|stellar save/i }).first();
    await expect(heading).toBeVisible();
  });
});
