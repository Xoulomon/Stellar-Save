import { Suspense, type JSX } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './constants';
import { RouteBoundary } from './RouteBoundary';
import { RouteLoadingFallback } from './RouteLoadingFallback';
import { routeConfig } from './routes';

/**
 * Main application router component.
 * Renders routes based on centralized configuration.
 * Each route is wrapped in its own RouteErrorBoundary so that an error in
 * one page does not blank the entire app — the navigation shell stays intact
 * and the user can navigate to another route.
 */
export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {routeConfig.map((route) => {
          const Component = route.component;
          let element: JSX.Element;
          if (route.adminOnly) {
            element = (
              <RouteBoundary>
                <AdminRoute>
                  <Component />
                </AdminRoute>
              </RouteBoundary>
            );
          } else if (route.protected) {
            element = (
              <RouteBoundary>
                <ProtectedRoute>
                  <Component />
                </ProtectedRoute>
              </RouteBoundary>
            );
          } else {
            element = (
              <RouteBoundary>
                <Component />
              </RouteBoundary>
            );
          }

          return <Route key={route.path} path={route.path} element={element} />;
        })}

        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Routes>
    </Suspense>
  );
}
