/**
 * Standalone entry for Playwright component screenshots.
 * Compiled only by `npm run build:visual` (see vite.config.ts).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import VisualGalleryPage from './pages/VisualGalleryPage';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <VisualGalleryPage />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
