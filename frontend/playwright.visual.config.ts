import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Percy visual regression tests.
 * Run via: npm run test:visual
 * Requires PERCY_TOKEN env var (set in CI secrets or locally).
 */
export default defineConfig({
  testDir: './src/test/visual',
  timeout: 60_000,
  retries: 0,
  workers: 1, // Percy requires sequential snapshots
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173', // Vite preview server
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--disable-web-security'] },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
  projects: [
    // Desktop baseline
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'] } },

    // Mobile — Android
    { name: 'mobile-pixel5', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-pixel7', use: { ...devices['Pixel 7'] } },

    // Mobile — iOS
    { name: 'mobile-iphone14', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-iphone14-pro-max', use: { ...devices['iPhone 14 Pro Max'] } },

    // Tablet
    { name: 'tablet-ipad-pro', use: { ...devices['iPad Pro 11'] } },
  ],
});
