import { test, expect, Page } from '@playwright/test';

/**
 * E2E coverage for the payout flow.
 *
 * Before: no dedicated payout spec existed in tests/e2e, so payout
 * submission, validation and failure paths were untested.
 * After: this spec drives the payout form through the happy path plus
 * the error cases (invalid amount, insufficient balance, failed submission).
 */

const PAYOUT_PATH = '/payouts';

async function gotoPayout(page: Page) {
  await page.goto(PAYOUT_PATH);
  await expect(page.getByRole('heading', { name: /payout/i })).toBeVisible();
}

async function fillPayout(page: Page, amount: string, recipient = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV') {
  await page.getByLabel(/recipient/i).fill(recipient);
  await page.getByLabel(/amount/i).fill(amount);
}

test.describe('Payout flow', () => {
  test.beforeEach(async ({ page }) => {
    await gotoPayout(page);
  });

  test('submits a valid payout successfully', async ({ page }) => {
    await fillPayout(page, '100');

    await page.getByRole('button', { name: /submit|send payout/i }).click();

    await expect(page.getByText(/payout (submitted|sent|successful)/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toHaveValue('');
  });

  test('rejects an invalid amount', async ({ page }) => {
    await fillPayout(page, '-5');

    await page.getByRole('button', { name: /submit|send payout/i }).click();

    await expect(page.getByText(/invalid amount|amount must be/i)).toBeVisible();
    await expect(page.getByText(/payout (submitted|sent|successful)/i)).toHaveCount(0);
  });

  test('blocks payout when balance is insufficient', async ({ page }) => {
    await fillPayout(page, '999999999');

    await page.getByRole('button', { name: /submit|send payout/i }).click();

    await expect(page.getByText(/insufficient (balance|funds)/i)).toBeVisible();
  });

  test('surfaces a failed submission error', async ({ page }) => {
    await page.route('**/api/payouts', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
    );

    await fillPayout(page, '100');
    await page.getByRole('button', { name: /submit|send payout/i }).click();

    await expect(page.getByText(/failed to (submit|send) payout|something went wrong/i)).toBeVisible();
  });
});
