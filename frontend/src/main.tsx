import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { ToastProvider } from './components/Toast';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { queryClient } from './lib/queryClient';
import { registerServiceWorker } from './notifications/serviceWorkerRegistration';
import './index.css';

// Initialise distributed tracing (no-op unless VITE_OTEL_ENABLED=true).
// Loaded lazily so the OpenTelemetry packages stay out of the main bundle.
if (import.meta.env.VITE_OTEL_ENABLED === 'true') {
  import('./lib/tracing').then((m) => m.startTracing()).catch(() => {
    // Tracing must never break app startup.
  });
}

// Register service worker for PWA support (caching, offline, push, updates).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      enableErrorReporting={import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true'}
      sentryDsn={import.meta.env.VITE_SENTRY_DSN}
    >
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <WalletProvider>
            <ToastProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </WalletProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
