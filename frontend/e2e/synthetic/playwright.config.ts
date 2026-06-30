import { defineConfig, devices } from '@playwright/test';

/**
 * Synthetic monitoring config — runs the canary spec against a live deployment
 * (CANARY_BASE_URL), not a local dev server. Used by .github/workflows/synthetic-monitoring.yml.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: process.env['CANARY_BASE_URL'] ?? 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
