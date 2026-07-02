import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'
import { visualizer } from 'rollup-plugin-visualizer'

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net/npm/stellar-sdk",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://horizon.stellar.org",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "report-uri /api/csp-report",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    imagetools(),
    // Writes dist/stats.html — open after `npm run build:analyze`
    visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
  ],
  server: {
    headers: {
      'Content-Security-Policy': CSP,
    },
  },
  build: {
    chunkSizeWarningLimit: 100,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-stellar': ['@stellar/stellar-sdk', '@stellar/freighter-api'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          // Heavy route chunks split out to reduce initial bundle size.
          // Each entry is resolved from the page module; tree-shaking keeps
          // page-specific dependencies (recharts, MUI X Data Grid, etc.) out
          // of the initial load path.
          'route-analytics': [
            './src/pages/AnalyticsDashboardPage.tsx',
            './src/pages/PlatformAnalyticsDashboard.tsx',
            './src/pages/GroupAnalytics.tsx',
            './src/pages/GroupComparisonPage.tsx',
          ],
          'route-admin': [
            './src/pages/FeedbackAdminPage.tsx',
          ],
          'route-charts': [
            'recharts',
          ],
        },
      },
    },
  },
})
