import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { ROUTES } from './constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard component that requires wallet authentication.
 * Redirects to home page if user is not authenticated.
 * Preserves the intended destination for post-authentication redirect.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useWallet();
  const location = useLocation();

  // Store the intended destination in sessionStorage
  useEffect(() => {
    if (status !== 'connected') {
      sessionStorage.setItem('redirectAfterAuth', location.pathname + location.search);
    }
  }, [status, location]);

  // Redirect to home if not authenticated
  if (status !== 'connected') {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}

