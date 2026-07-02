import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for full ROSCA journey tests against a local Stellar standalone network.
 * The standalone network runs at http://localhost:8000 (Stellar Quickstart).
 * The frontend dev server runs at http://localhost:5173.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  workers: 1, // serial — tests share on-chain state
  reporter: process.env['CI'] ? [['github'], ['html', { outputFolder: 'e2e-report', open: 'never' }]] : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--disable-web-security'] },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    cwd: '..',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      VITE_STELLAR_NETWORK: 'standalone',
      VITE_STELLAR_RPC_URL: process.env['STELLAR_RPC_URL'] ?? 'http://localhost:8000/soroban/rpc',
      VITE_HORIZON_URL: process.env['HORIZON_URL'] ?? 'http://localhost:8000',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
