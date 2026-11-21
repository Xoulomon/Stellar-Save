import { test, expect } from '@playwright/test';

import type { Page } from '@playwright/test';

const PUBLIC_KEY = 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE';

async function mockConnectedWallet(page: Page) {
  await page.addInitScript((publicKey: string) => {
    const wallet = {
      isConnected: () => Promise.resolve(true),
      isAllowed: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve(publicKey),
      getNetwork: () => Promise.resolve('TESTNET'),
      getNetworkDetails: () =>
        Promise.resolve({
          network: 'TESTNET',
          networkPassphrase: 'Test SDF Network ; September 2015',
        }),
      signTransaction: (xdr: string) => Promise.resolve(xdr),
      signAuthEntry: (entry: string) => Promise.resolve(entry),
    };
    (window as unknown as Record<string, unknown>).freighter = wallet;
    (window as unknown as Record<string, unknown>).freighterApi = wallet;
  }, PUBLIC_KEY);
}

async function openCreateGroupPage(page: Page) {
  await mockConnectedWallet(page);
  await page.goto('/groups/create');
  await expect(page.getByRole('heading', { name: /create new rosca group/i })).toBeVisible();
  await expect(page.getByLabel(/group name/i)).toBeVisible();
}

async function fillRequiredSteps(page: Page) {
  await page.getByLabel(/group name/i).fill('E2E Savings Circle');
  await page.getByLabel(/description/i).fill('Automated end-to-end test group');
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByLabel(/contribution amount/i).fill('50');
  await page.getByRole('combobox').selectOption('604800');
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByLabel(/maximum members/i).fill('8');
  await page.getByLabel(/minimum members/i).fill('2');
  await page.getByRole('button', { name: /^next$/i }).click();

  await page.getByRole('button', { name: /^next$/i }).click();
  await expect(page.getByRole('heading', { name: /review & confirm/i })).toBeVisible();
}

test.describe('Group creation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('create-group-draft'));
  });

  test('loads the create-group page and shows the five-step wizard', async ({ page }) => {
    await openCreateGroupPage(page);

    await expect(page).toHaveTitle(/create group|stellar.save/i);
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible();
    await expect(page.getByRole('navigation', { name: /form progress/i })).toBeVisible();
  });

  test('blocks advancement and shows validation errors for missing basics', async ({ page }) => {
    await openCreateGroupPage(page);

    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByText(/at least 3 characters/i)).toBeVisible();
    await expect(page.getByText(/description is required/i)).toBeVisible();
    await expect(page.getByText(/step 1 of 5/i)).toBeVisible();
  });

  test('blocks financial advancement for invalid contribution settings', async ({ page }) => {
    await openCreateGroupPage(page);

    await page.getByLabel(/group name/i).fill('E2E Savings Circle');
    await page.getByLabel(/description/i).fill('Automated end-to-end test group');
    await page.getByRole('button', { name: /^next$/i }).click();
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByText(/contribution amount must be greater than 0/i)).toBeVisible();
    await expect(page.getByText(/please select a valid cycle duration/i)).toBeVisible();
  });

  test('creates a group and redirects to the created group', async ({ page }) => {
    await openCreateGroupPage(page);
    await fillRequiredSteps(page);

    await page.getByRole('button', { name: /create group/i }).click();

    await expect(page.getByRole('status')).toContainText(/group created successfully/i);
    await expect(page).toHaveURL(/\/groups\/mock-group-id$/, { timeout: 5_000 });
  });

  test('shows an error for an invalid insurance premium and stays on insurance step', async ({
    page,
  }) => {
    await openCreateGroupPage(page);
    await fillRequiredSteps(page);

    await page.getByRole('button', { name: /back/i }).click();
    await page.getByLabel(/enable insurance pool/i).check();
    await page.getByLabel(/premium rate/i).fill('101');
    await page.getByRole('button', { name: /^next$/i }).click();

    await expect(page.getByText(/premium must be between 0 and 100/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /insurance pool/i })).toBeVisible();
  });

  test('cancel returns to the dashboard', async ({ page }) => {
    await openCreateGroupPage(page);

    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
