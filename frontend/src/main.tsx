import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { ToastProvider } from './components/Toast';
import { AppRouter } from './routing/AppRouter';
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
    <AppThemeProvider>
      <WalletProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </ToastProvider>
      </WalletProvider>
    </AppThemeProvider>
  </StrictMode>
);
