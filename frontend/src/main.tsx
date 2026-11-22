import './i18n';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { GroupRepositoryProvider } from './lib/groupRepository/GroupRepositoryContext';
import { logger } from './lib/logger';
import { queryClient } from './lib/queryClient';
import { registerServiceWorker } from './notifications/serviceWorkerRegistration';
import { env } from './lib/env';
import './index.css';

// Initialise distributed tracing (no-op unless VITE_OTEL_ENABLED=true).
// Loaded lazily so the OpenTelemetry packages stay out of the main bundle.
if (env.VITE_OTEL_ENABLED) {
  import('./lib/tracing')
    .then((m) => m.startTracing())
    .catch((error: unknown) => {
      // Tracing must never break app startup.
      logger.warn('Failed to initialise tracing', error);
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
      enableErrorReporting={env.VITE_ENABLE_ERROR_REPORTING}
      sentryDsn={env.VITE_SENTRY_DSN}
    >
      <QueryClientProvider client={queryClient}>
        <GroupRepositoryProvider>
          <AppThemeProvider>
            <WalletProvider>
              <ToastProvider>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ToastProvider>
            </WalletProvider>
          </AppThemeProvider>
        </GroupRepositoryProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
