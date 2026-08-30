import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for component screenshot tests (committed PNG baselines).
 * Run via: npm run test:visual:components
 *
 * Requires a visual gallery build first (`npm run build:visual`) so the
 * /__visual__/components route is present in the production preview bundle.
 */
export default defineConfig({
  testDir: './src/test/visual/components',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.001,
    },
  },
  // Stable names (no OS/project suffix). Baselines are generated on Linux
  // so they match ubuntu-latest CI. See docs/visual-regression.md.
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--disable-web-security'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/visual-gallery.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
