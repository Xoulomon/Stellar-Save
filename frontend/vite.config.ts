import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  server: {
    headers: {
      'Content-Security-Policy': CSP,
    },
  },
})
