import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Shared utilities package alias — mirrors vite.config.ts
      '@shared-utils': path.resolve(__dirname, '../packages/shared-utils/src'),
      '@creit.tech/stellar-wallets-kit/modules/freighter': path.resolve(
        __dirname,
        'node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/freighter.module.js',
      ),
      '@creit.tech/stellar-wallets-kit/modules/albedo': path.resolve(
        __dirname,
        'node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/albedo.module.js',
      ),
      '@creit.tech/stellar-wallets-kit/modules/lobstr': path.resolve(
        __dirname,
        'node_modules/@creit.tech/stellar-wallets-kit/esm/sdk/modules/lobstr.module.js',
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Every `*.spec.ts` in this package belongs to Playwright, not Vitest.
    // Without this, Vitest's default glob collects them and the suite fails
    // trying to import `@playwright/test` outside a Playwright runner.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.spec.ts', '**/*.spec.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'cobertura', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/components/GroupCard.tsx', 'src/components/ContributionFlow.tsx', 'src/components/TransactionHistory.tsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
