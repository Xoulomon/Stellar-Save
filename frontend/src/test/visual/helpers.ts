import type { Page } from '@playwright/test';

/** Disable CSS transitions/animations for deterministic snapshots. */
export async function freezeAnimations(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }`,
  });
}

/** Force dark color-scheme without relying on OS emulation. */
export async function enableDarkMode(page: Page) {
  await page.addStyleTag({ content: ':root { color-scheme: dark; }' });
  await page.emulateMedia({ colorScheme: 'dark' });
}

/**
 * Inject a mock connected-wallet flag so ProtectedRoute allows access
 * to authenticated screens without a real wallet extension.
 */
export async function mockWalletConnected(page: Page) {
  await page.evaluate(() => {
    sessionStorage.setItem('__mock_wallet_connected__', 'true');
  });
}
