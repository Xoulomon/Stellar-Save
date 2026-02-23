import { Navigate, Outlet } from 'react-router-dom';
import { useWallet } from '../store';
import { ROUTES } from '../constants/routes';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const wallet = useWallet();

  if (!wallet.isConnected) {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
