/**
 * Mobile visual regression tests — issue #1113
 *
 * Captures Percy snapshots of all major screens in:
 * - Light mode (default)
 * - Dark mode (prefers-color-scheme: dark)
 *
 * Device sizes are controlled by the Playwright project matrix in
 * playwright.visual.config.ts (Pixel 5, iPhone 14, Galaxy Tab S4).
 * Percy diffs every snapshot against the approved baseline and blocks
 * the PR if an unintended change is detected.
 *
 * To update baselines: approve the diff in the Percy dashboard.
 * See docs/visual-regression.md for the full baseline-update workflow.
 */
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

// === Helpers

/** Disable CSS transitions/animations for deterministic snapshots. */
async function freezeAnimations(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`,
  });
}

/** Force dark color-scheme on the page without relying on OS emulation. */
async function enableDarkMode(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: ':root { color-scheme: dark; }' });
  await page.emulateMedia({ colorScheme: 'dark' });
}

/**
 * Inject a mock connected-wallet flag so ProtectedRoute allows access
 * to authenticated screens without a real wallet extension.
 */
async function mockWalletConnected(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    sessionStorage.setItem('__mock_wallet_connected__', 'true');
  });
}

/** Take both light and dark snapshots with a single call. */
async function snapshotBothModes(
  page: import('@playwright/test').Page,
  name: string,
) {
  await percySnapshot(page, `${name} - light`);
  await enableDarkMode(page);
  await percySnapshot(page, `${name} - dark`);
}

// === Landing page

test('Mobile: Landing page - light and dark', async ({ page }) => {
  await page.goto('/');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: Landing page');
});

// === Wallet connection

test('Mobile: Wallet button - disconnected state', async ({ page }) => {
  await page.goto('/');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: Wallet button - disconnected');
});

// === Browse Groups

test('Mobile: Browse Groups - empty state', async ({ page }) => {
  await page.goto('/');
  await mockWalletConnected(page);
  await page.goto('/groups/browse');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: Browse Groups - empty state');
});

// === Create Group form

test('Mobile: Create Group form - step 1 empty', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: Create Group - step 1 empty');
});

test('Mobile: Create Group form - step 1 validation errors', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /next/i }).click();
  await snapshotBothModes(page, 'Mobile: Create Group - step 1 validation errors');
});

test('Mobile: Create Group form - step 2 financial settings', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/group name/i).fill('My Savings Circle');
  await page.getByLabel(/description/i).fill('A community savings group');
  await page.getByRole('button', { name: /next/i }).click();
  await snapshotBothModes(page, 'Mobile: Create Group - step 2 financial settings');
});

// === Profile / Dashboard

test('Mobile: Dashboard page - authenticated empty state', async ({ page }) => {
  await page.goto('/');
  await mockWalletConnected(page);
  await page.goto('/dashboard');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: Dashboard - empty state');
});

// === Navigation / bottom bar

test('Mobile: Bottom navigation bar visible', async ({ page }) => {
  await page.goto('/');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  // Scroll to bottom to ensure nav bar is in frame on short-screen devices.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await snapshotBothModes(page, 'Mobile: Bottom navigation bar');
});

// === 404 page

test('Mobile: 404 Not Found page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await snapshotBothModes(page, 'Mobile: 404 Not Found page');
});
