import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { AppRouter } from './routing/AppRouter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <WalletProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </WalletProvider>
    </AppThemeProvider>
  </StrictMode>
);
