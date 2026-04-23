/**
 * Visual regression tests using Percy + Playwright.
 *
 * These tests start the Vite dev server, navigate to each key UI surface,
 * and send a Percy snapshot. Percy compares against the approved baseline
 * and fails the build if unintended visual changes are detected.
 *
 * Prerequisites:
 *   - Set PERCY_TOKEN in CI secrets (see docs/visual-regression.md)
 *   - Run: npm run test:visual
 *
 * To update baselines: approve the changes in the Percy dashboard at
 *   https://percy.io
 */
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Disable CSS transitions/animations for deterministic snapshots */
async function freezeAnimations(page: import('@playwright/test').Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`,
  });
}

// ── Landing / Home ────────────────────────────────────────────────────────────

test('Landing page — default state', async ({ page }) => {
  await page.goto('/');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'Landing page');
});

// ── Wallet connection UI ──────────────────────────────────────────────────────

test('Wallet button — disconnected state', async ({ page }) => {
  await page.goto('/');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'Wallet button - disconnected');
});

// ── Browse Groups page ────────────────────────────────────────────────────────

test('Browse Groups page — empty state', async ({ page }) => {
  // The app redirects unauthenticated users to home; snapshot the browse page
  // by injecting a mock connected wallet via localStorage before navigation.
  await page.goto('/');
  await page.evaluate(() => {
    // Simulate a connected wallet so ProtectedRoute allows access
    sessionStorage.setItem('__mock_wallet_connected__', 'true');
  });
  await page.goto('/groups/browse');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'Browse Groups - empty state');
});

// ── Create Group form ─────────────────────────────────────────────────────────

test('Create Group form — step 1 empty', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, 'Create Group form - step 1 empty');
});

test('Create Group form — step 1 validation errors', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  // Trigger validation by clicking Next without filling fields
  await page.getByRole('button', { name: /next/i }).click();
  await percySnapshot(page, 'Create Group form - step 1 validation errors');
});

test('Create Group form — step 2 financial settings', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await page.getByLabel(/group name/i).fill('My Savings Circle');
  await page.getByLabel(/description/i).fill('A community savings group');
  await page.getByRole('button', { name: /next/i }).click();
  await percySnapshot(page, 'Create Group form - step 2 financial settings');
});

test('Create Group form — step 4 review', async ({ page }) => {
  await page.goto('/groups/create');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  // Step 1
  await page.getByLabel(/group name/i).fill('My Savings Circle');
  await page.getByLabel(/description/i).fill('A community savings group');
  await page.getByRole('button', { name: /next/i }).click();
  // Step 2
  await page.getByLabel(/contribution amount/i).fill('50');
  await page.selectOption('select#cycleDuration', '2592000');
  await page.getByRole('button', { name: /next/i }).click();
  // Step 3
  await page.getByLabel(/maximum members/i).fill('10');
  await page.getByRole('button', { name: /next/i }).click();
  await percySnapshot(page, 'Create Group form - step 4 review');
});

// ── 404 page ──────────────────────────────────────────────────────────────────

test('404 Not Found page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await freezeAnimations(page);
  await page.waitForLoadState('networkidle');
  await percySnapshot(page, '404 Not Found page');
});
