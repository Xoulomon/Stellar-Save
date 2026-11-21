import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 *
 * The `join-and-contribute` spec exercises the full member journey:
 * connect wallet -> join a group -> contribute to the pool. It is kept in its
 * own project so it can be run in isolation (`--project=join-and-contribute`)
 * while still sharing the base config with the rest of the suite.
 *
 * The `payout` spec exercises the payout journey: request a payout -> validate
 * the amount -> submit -> confirm the payout is recorded. It is likewise kept
 * in its own project so it can be run in isolation (`--project=payout`).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /(join-and-contribute|payout)\.spec\.ts/,
    },
    {
      name: 'join-and-contribute',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /join-and-contribute\.spec\.ts/,
    },
    {
      name: 'payout',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /payout\.spec\.ts/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
