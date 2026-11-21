import { test, expect, Page } from '@playwright/test';

/**
 * E2E: join and contribute flow
 *
 * Covers the happy path (connect wallet -> join a group -> contribute)
 * plus error cases (rejected wallet connection, contribution below the
 * minimum amount, and a failed contribution transaction).
 */

const GROUP_ID = 'group-e2e-1';
const MIN_CONTRIBUTION = 10;

async function connectWallet(page: Page) {
  await page.getByRole('button', { name: /connect wallet/i }).click();
  await expect(page.getByText(/wallet connected/i)).toBeVisible();
}

async function joinGroup(page: Page, groupId: string) {
  await page.goto(`/groups/${groupId}`);
  await page.getByRole('button', { name: /join group/i }).click();
  await expect(page.getByText(/you have joined/i)).toBeVisible();
}

test.describe('join and contribute flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('joins a group and contributes successfully', async ({ page }) => {
    await connectWallet(page);
    await joinGroup(page, GROUP_ID);

    await page.getByLabel(/contribution amount/i).fill(String(MIN_CONTRIBUTION));
    await page.getByRole('button', { name: /contribute/i }).click();

    await expect(page.getByText(/contribution successful/i)).toBeVisible();
    await expect(page.getByText(/you have joined/i)).toBeVisible();
  });

  test('shows an error when the wallet connection is rejected', async ({ page }) => {
    await page.getByRole('button', { name: /connect wallet/i }).click();
    await page.getByRole('button', { name: /reject/i }).click();

    await expect(page.getByText(/wallet connection failed/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /join group/i })).toBeDisabled();
  });

  test('rejects a contribution below the minimum amount', async ({ page }) => {
    await connectWallet(page);
    await joinGroup(page, GROUP_ID);

    await page.getByLabel(/contribution amount/i).fill(String(MIN_CONTRIBUTION - 1));
    await page.getByRole('button', { name: /contribute/i }).click();

    await expect(page.getByText(/minimum contribution/i)).toBeVisible();
    await expect(page.getByText(/contribution successful/i)).not.toBeVisible();
  });

  test('surfaces an error when the contribution transaction fails', async ({ page }) => {
    await connectWallet(page);
    await joinGroup(page, GROUP_ID);

    await page.getByLabel(/contribution amount/i).fill(String(MIN_CONTRIBUTION));
    await page.getByRole('button', { name: /contribute/i }).click();

    await expect(page.getByText(/transaction failed/i)).toBeVisible();
    await expect(page.getByText(/contribution successful/i)).not.toBeVisible();
  });
});
