import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for component screenshot tests (committed PNG baselines).
 * Run via: npm run test:visual:components
 *
 * Requires a visual gallery build first (`npm run build:visual`) so the
 * /__visual__/components route is present in the production preview bundle.
 *
 * Determinism: the clock is frozen, animations/transitions are disabled,
 * fonts are pinned to a consistent stack, and the viewport is fixed so
 * screenshots only change when the UI actually changes.
 */

// Fixed instant used for every visual run so time-dependent UI is stable.
const FROZEN_TIME = new Date('2024-01-01T00:00:00.000Z');

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
    // Freeze the clock so timestamps/relative times are deterministic.
    clock: { time: FROZEN_TIME },
    // Pin fonts to a consistent stack and disable animations/transitions.
    // Injected into every page before the app boots.
    addStyleTag: {
      content: `
        *, *::before, *::after {
          font-family: 'Arial', 'Helvetica', sans-serif !important;
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
        }
        html { -webkit-font-smoothing: antialiased; }
      `,
    },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173/visual-gallery.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
