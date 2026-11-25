import { lazy, Suspense } from 'react';

import './App.css';
import { useDeepLink } from './hooks/useDeepLink';
import { RouteLoadingFallback } from './routing/RouteLoadingFallback';

const AppRouter = lazy(() => import('./routing/AppRouter').then((m) => ({ default: m.AppRouter })));

export default function App() {
  // Initialize deep link handler
  useDeepLink();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <AppRouter />
    </Suspense>
  );
}
