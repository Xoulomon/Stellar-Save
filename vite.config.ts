/**
 * Root Vite config — used only by workspace-level tooling (e.g. Vitest).
 *
 * The frontend application has its own config at `frontend/vite.config.ts`,
 * which owns all production build settings including manual chunks, the
 * visualizer plugin, imagetools, and CSP headers. Do not duplicate those
 * settings here.
 *
 * This file keeps only what workspace-level test runners need:
 *   - path alias resolution so imports like `@/…` resolve during tests.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@shared-utils': fileURLToPath(new URL('./packages/shared-utils/src', import.meta.url)),
    },
  },
});
