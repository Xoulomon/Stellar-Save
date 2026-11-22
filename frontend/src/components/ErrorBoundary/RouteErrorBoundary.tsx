/**
 * RouteErrorBoundary.tsx
 *
 * Thin wrapper around ErrorBoundary sized for a single route slot.
 * Wrapping each route separately means an error in one page leaves the
 * navigation shell (header, sidebar, etc.) intact and other routes reachable.
 *
 * Usage in AppRouter:
 *   <RouteErrorBoundary routeName="Dashboard">
 *     <DashboardPage />
 *   </RouteErrorBoundary>
 */

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export interface RouteErrorBoundaryProps {
  /** Human-readable route name used in error reporting context. */
  routeName?: string;
  children: React.ReactNode;
}

/**
 * Per-route error boundary.  Errors are caught here so the navigation shell
 * stays usable.  The reset action re-renders the route from scratch.
 */
export function RouteErrorBoundary({ routeName, children }: RouteErrorBoundaryProps) {
  const handleError = React.useCallback(
    (error: Error, info: React.ErrorInfo) => {
      // Forward to whatever logger is wired up (console in dev, Sentry in prod
      // via the global ErrorBoundary in main.tsx).  Using console.error keeps
      // the message visible without introducing a hard dependency here.
      console.error(
        `[RouteErrorBoundary]${routeName ? ` Route "${routeName}"` : ''} threw:`,
        error,
        info,
      );
    },
    [routeName],
  );

  return <ErrorBoundary onError={handleError}>{children}</ErrorBoundary>;
}

export default RouteErrorBoundary;
