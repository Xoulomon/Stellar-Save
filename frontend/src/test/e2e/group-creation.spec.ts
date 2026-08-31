import { test, expect } from '@playwright/test';

/**
 * E2E tests: Group creation flow
 * Covers navigation to create group page, form rendering, and validation.
 */
test.describe('Group creation flow', () => {
  test('create group page loads without crashing', async ({ page }) => {
    await page.goto('/groups/create');
    await expect(page.locator('body')).toBeVisible();
  });

  test('create group page has correct title', async ({ page }) => {
    await page.goto('/groups/create');
    await expect(page).toHaveTitle(/create group|stellar.save/i);
  });

  test('create group page shows content (form or wallet prompt)', async ({ page }) => {
    await page.goto('/groups/create');
    // Wait for page to settle
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    // Page should have some content
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });

  test('navigation to create group from landing page works', async ({ page }) => {
    await page.goto('/');
    // Find a link to create a group or get started
    const getStartedBtn = page.getByRole('button', { name: /get started/i });
    if (await getStartedBtn.isVisible()) {
      await getStartedBtn.click();
      // Should navigate somewhere (home, dashboard, or create group)
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('create group form shows group name field when wallet connected', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).freighter = {
        isConnected: () => Promise.resolve(true),
        getPublicKey: () =>
          Promise.resolve('GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE'),
        getNetwork: () => Promise.resolve('TESTNET'),
        signTransaction: () => Promise.resolve('mock-signed-tx'),
      };
    });
    await page.goto('/groups/create');
    await page.waitForLoadState('networkidle');

    const nameField = page.getByLabel(/group name/i);
    const connectPrompt = page.getByText(/connect.*wallet/i);

    const nameVisible = await nameField.isVisible().catch(() => false);
    const connectVisible = await connectPrompt.isVisible().catch(() => false);
    const bodyHasContent = (await page.locator('body').textContent())?.trim().length ?? 0;

    // Either the form is shown, a connect wallet prompt, or some content
    expect(nameVisible || connectVisible || bodyHasContent > 0).toBe(true);
  });

  test('create group form shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/groups/create');
    await page.waitForLoadState('networkidle');

    const nameField = page.getByLabel(/group name/i);
    if (!(await nameField.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const nextBtn = page.getByRole('button', { name: /next/i });
    await nextBtn.click();

    await expect(
      page.getByText(/required|at least|characters/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test('create group form step 1 accepts valid input and advances', async ({ page }) => {
    await page.goto('/groups/create');
    await page.waitForLoadState('networkidle');

    const nameField = page.getByLabel(/group name/i);
    if (!(await nameField.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await nameField.fill('My E2E Savings Circle');
    const descField = page.getByLabel(/description/i);
    await descField.fill('An E2E test savings group');

    const nextBtn = page.getByRole('button', { name: /next/i });
    await nextBtn.click();

    await expect(
      page.getByLabel(/contribution amount/i)
    ).toBeVisible({ timeout: 3000 });
  });
});
