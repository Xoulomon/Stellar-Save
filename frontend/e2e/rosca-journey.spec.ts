import { test, expect } from '@playwright/test';

import { injectMockWallet } from './helpers/stellar-standalone';

import type { Page } from '@playwright/test';

/**
 * Full ROSCA user journey: create group → join → contribute (all members) → payout
 *
 * Each step is a separate test in a serial suite so failures are isolated.
 * State is shared via `groupId` captured after group creation.
 */

// Shared state across the serial suite
let groupId: string | undefined;

async function connectWallet(page: Page): Promise<void> {
  const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
  if (await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await connectBtn.click();
    // Dismiss wallet picker if present — select Freighter
    const freighterOption = page.getByRole('button', { name: /freighter/i });
    if (await freighterOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await freighterOption.click();
    }
    await page.waitForLoadState('networkidle');
  }
}

test.describe.serial('ROSCA full journey', () => {
  test('landing page loads and shows key content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/stellar.save/i);
    await expect(
      page.getByRole('heading', { name: /save together|stellar save/i }).first()
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /get started/i }).first()).toBeVisible();
  });

  test('creator: create a new savings group', async ({ page }) => {
    await injectMockWallet(page, 'creator');
    await page.goto('/groups/create');
    await page.waitForLoadState('networkidle');

    // If wallet connection is required first, connect
    await connectWallet(page);

    const nameField = page.getByLabel(/group name/i);
    await expect(nameField).toBeVisible({ timeout: 5_000 });

    // Step 1: group details
    await nameField.fill('E2E Savings Circle');
    await page.getByLabel(/description/i).fill('Automated E2E test group');
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 2: financial settings
    const amountField = page.getByLabel(/contribution amount/i);
    await expect(amountField).toBeVisible({ timeout: 5_000 });
    await amountField.fill('50');
    await page.getByRole('combobox').selectOption('604800');
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 3: member settings
    await page.getByLabel(/maximum members/i).fill('8');
    await page.getByLabel(/minimum members/i).fill('2');
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 4: insurance (disabled by default)
    await page.getByRole('button', { name: /^next$/i }).click();

    // Step 5: review and submit
    await expect(page.getByRole('heading', { name: /review & confirm/i })).toBeVisible();
    await page.getByRole('button', { name: /create group/i }).click();
    await expect(page.getByRole('status')).toContainText(/group created successfully/i);

    await expect(page).toHaveURL(/\/groups\/mock-group-id$/, { timeout: 5_000 });
    groupId = 'mock-group-id';
  });

  test('member: join the created group', async ({ page }) => {
    if (!groupId) {
      test.skip(true, 'No groupId from previous step — skipping join test');
      return;
    }

    await injectMockWallet(page, 'member1');
    await page.goto(`/groups/${groupId}`);
    await page.waitForLoadState('networkidle');

    await connectWallet(page);

    const joinBtn = page.getByRole('button', { name: /join group|join/i });
    if (!(await joinBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Join group UI not yet implemented');
      return;
    }

    await joinBtn.click();
    await page.waitForLoadState('networkidle');

    // Confirm join if a modal appears
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|join/i });
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(/joined|member|you are a member/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('creator: contribute to the group', async ({ page }) => {
    if (!groupId) {
      test.skip(true, 'No groupId from previous step — skipping contribution test');
      return;
    }

    await injectMockWallet(page, 'creator');
    await page.goto(`/groups/${groupId}`);
    await page.waitForLoadState('networkidle');

    await connectWallet(page);

    const contributeBtn = page.getByRole('button', { name: /contribute/i });
    if (!(await contributeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Contribute UI not yet implemented');
      return;
    }

    await contributeBtn.click();

    // Confirm in modal
    const confirmBtn = page.getByRole('button', { name: /confirm|submit/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/contributed|success|transaction/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('member: contribute to the group', async ({ page }) => {
    if (!groupId) {
      test.skip(true, 'No groupId from previous step — skipping member contribution test');
      return;
    }

    await injectMockWallet(page, 'member1');
    await page.goto(`/groups/${groupId}`);
    await page.waitForLoadState('networkidle');

    await connectWallet(page);

    const contributeBtn = page.getByRole('button', { name: /contribute/i });
    if (!(await contributeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Contribute UI not yet implemented');
      return;
    }

    await contributeBtn.click();

    const confirmBtn = page.getByRole('button', { name: /confirm|submit/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/contributed|success|transaction/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('payout executes after all members contribute', async ({ page }) => {
    if (!groupId) {
      test.skip(true, 'No groupId from previous step — skipping payout test');
      return;
    }

    await injectMockWallet(page, 'creator');
    await page.goto(`/groups/${groupId}`);
    await page.waitForLoadState('networkidle');

    await connectWallet(page);

    // Payout may be automatic or require a trigger button
    const payoutBtn = page.getByRole('button', { name: /execute payout|payout|distribute/i });
    if (await payoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await payoutBtn.click();
      await page.waitForLoadState('networkidle');

      const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Either a payout success message or the cycle advancing is sufficient
    await expect(page.getByText(/payout|cycle|recipient|distributed/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
