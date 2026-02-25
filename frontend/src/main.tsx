import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { ToastProvider } from './components/Toast';
import { AppRouter } from './routing/AppRouter';
import './index.css';

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
