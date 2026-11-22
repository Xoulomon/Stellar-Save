import { lazy, Suspense } from 'react';

import './App.css';
import { AppProviders } from './context/AppProviders';
import { GroupRepositoryProvider } from './context/GroupRepositoryProvider';
import { useDeepLink } from './hooks/useDeepLink';
import { RouteLoadingFallback } from './routing/RouteLoadingFallback';

const AppRouter = lazy(() => import('./routing/AppRouter').then((m) => ({ default: m.AppRouter })));

export default function App() {
  // Initialize deep link handler
  useDeepLink();

  return (
    <AppProviders>
      <GroupRepositoryProvider>
        <Suspense fallback={<RouteLoadingFallback />}>
          <AppRouter />
        </Suspense>
      </GroupRepositoryProvider>
    </AppProviders>
  );
}