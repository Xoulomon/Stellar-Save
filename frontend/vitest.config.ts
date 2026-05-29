import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
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
  },
});
