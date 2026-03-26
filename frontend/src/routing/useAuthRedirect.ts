import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { ROUTES } from './constants';

/**
 * Hook to handle post-authentication redirects.
 * Redirects user to their intended destination after successful wallet connection.
 */
export function useAuthRedirect() {
  const { status } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'connected') {
      const redirectPath = sessionStorage.getItem('redirectAfterAuth');
      
      if (redirectPath && redirectPath !== ROUTES.HOME) {
        sessionStorage.removeItem('redirectAfterAuth');
        navigate(redirectPath, { replace: true });
      }
    }
  }, [status, navigate]);
}
