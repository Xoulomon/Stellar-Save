// Root Vite config — used only by tooling (e.g. Vitest at the workspace level).
// The frontend app has its own config at frontend/vite.config.ts.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
