import './i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { ToastProvider } from './components/Toast';
import { AppRouter } from './routing/AppRouter';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import './index.css';

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failure is non-fatal
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      enableErrorReporting={import.meta.env.VITE_ENABLE_ERROR_REPORTING === 'true'}
      sentryDsn={import.meta.env.VITE_SENTRY_DSN}
    >
      <AppThemeProvider>
        <WalletProvider>
          <ToastProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </ToastProvider>
        </WalletProvider>
      </AppThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
