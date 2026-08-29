import { Navigate } from 'react-router-dom';

import { ROUTES } from './constants';
import { useWallet } from '../hooks/useWallet';
import { isAdminAddress } from '../utils/adminApi';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that requires both wallet connection and admin role.
 * Non-admins are redirected to the dashboard rather than a 404 to avoid
 * leaking the existence of the admin route.
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { status, activeAddress } = useWallet();

  if (status !== 'connected' || !activeAddress) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  if (!isAdminAddress(activeAddress)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
