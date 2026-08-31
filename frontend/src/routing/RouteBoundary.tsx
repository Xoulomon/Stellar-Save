/**
 * RouteBoundary — wraps a routed page in the full ErrorBoundary component.
 *
 * Replaces the lightweight RouteErrorBoundary with the richer ErrorBoundary
 * that provides retry logic, smart error messages, optional Sentry reporting,
 * and a polished MUI fallback UI.
 *
 * Usage (already wired in AppRouter):
 *   <RouteBoundary><SomePage /></RouteBoundary>
 */
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';

interface RouteBoundaryProps {
  children: React.ReactNode;
}

export function RouteBoundary({ children }: RouteBoundaryProps) {
  return (
    <ErrorBoundary
      enableErrorReporting={process.env.NODE_ENV !== 'test'}
      onError={(error, info) => {
        // Structured log so monitoring tools can pick it up
        console.error('[RouteBoundary] Unhandled render error', {
          message: error.message,
          componentStack: info.componentStack,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
