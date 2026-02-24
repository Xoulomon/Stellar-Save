import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { RouteParams } from './types';

/**
 * Custom navigation hook that wraps React Router's navigation utilities.
 * Provides type-safe navigation and parameter access.
 */
export function useNavigation() {
  const navigate = useNavigate();
  const params = useParams<RouteParams>();
  const location = useLocation();

  return {
    /** Navigate to a route */
    navigateTo: (path: string, options?: { replace?: boolean; state?: unknown }) => {
      navigate(path, options);
    },
    
    /** Navigate back in history */
    goBack: () => {
      navigate(-1);
    },
    
    /** Navigate forward in history */
    goForward: () => {
      navigate(1);
    },
    
    /** Current route parameters */
    params,
    
    /** Current location object */
    location,
    
    /** Navigate with state data */
    navigateWithState: <T>(path: string, state: T) => {
      navigate(path, { state });
    },
  };
}

