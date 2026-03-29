import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/visual',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
    // Consistent viewport for snapshot reproducibility
    viewport: { width: 1280, height: 720 },
    // Disable animations so snapshots are deterministic
    launchOptions: { args: ['--disable-web-security'] },
  },
  // Start the dev server automatically before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 60_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
