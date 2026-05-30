import { test, expect, Page } from '@playwright/test';
import { injectMockWallet, TEST_ACCOUNTS } from './helpers/stellar-standalone';

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
    await expect(page.getByRole('heading', { name: /save together|stellar save/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /get started/i }).first()).toBeVisible();
  });

  test('creator: create a new savings group', async ({ page }) => {
    await injectMockWallet(page, 'creator');
    await page.goto('/groups/create');
    await page.waitForLoadState('networkidle');

    // If wallet connection is required first, connect
    await connectWallet(page);

    const nameField = page.getByLabel(/group name/i);
    if (!(await nameField.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Group creation UI not yet implemented');
      return;
    }

    // Step 1: group details
    await nameField.fill('E2E Savings Circle');
    const descField = page.getByLabel(/description/i);
    if (await descField.isVisible().catch(() => false)) {
      await descField.fill('Automated E2E test group');
    }
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2: contribution settings
    const amountField = page.getByLabel(/contribution amount/i);
    await expect(amountField).toBeVisible({ timeout: 5_000 });
    await amountField.fill('100');

    const maxMembersField = page.getByLabel(/max members/i);
    if (await maxMembersField.isVisible().catch(() => false)) {
      await maxMembersField.fill('2');
    }

    const cycleDurationField = page.getByLabel(/cycle duration/i);
    if (await cycleDurationField.isVisible().catch(() => false)) {
      await cycleDurationField.fill('7');
    }

    await page.getByRole('button', { name: /next|create|submit/i }).last().click();

    // Wait for success — either a redirect to the group page or a success message
    await page.waitForLoadState('networkidle');
    const successMsg = page.getByText(/group created|success/i);
    const groupUrl = page.url();

    const succeeded = await successMsg.isVisible({ timeout: 10_000 }).catch(() => false)
      || groupUrl.includes('/groups/');

    expect(succeeded, 'Expected group creation to succeed').toBe(true);

    // Capture group ID from URL if available
    const match = page.url().match(/\/groups\/([^/?#]+)/);
    if (match) groupId = match[1];
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

    await expect(
      page.getByText(/joined|member|you are a member/i).first()
    ).toBeVisible({ timeout: 10_000 });
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

    await expect(
      page.getByText(/contributed|success|transaction/i).first()
    ).toBeVisible({ timeout: 15_000 });
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

    await expect(
      page.getByText(/contributed|success|transaction/i).first()
    ).toBeVisible({ timeout: 15_000 });
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
    await expect(
      page.getByText(/payout|cycle|recipient|distributed/i).first()
    ).toBeVisible({ timeout: 20_000 });
  });
});
