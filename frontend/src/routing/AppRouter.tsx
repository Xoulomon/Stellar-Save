import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { Skeleton } from '../components/Skeleton/Skeleton';
import { routeConfig } from './routes';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './constants';

/** Skeleton fallback shown while a lazy route chunk is downloading. */
function RouteLoadingFallback() {
  return (
    <Box
      role="status"
      aria-label="Loading page"
      sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: 'auto', mt: 3 }}
    >
      <Skeleton variant="rect" width="40%" height={32} style={{ marginBottom: 16 }} />
      <Skeleton variant="rect" width="100%" height={120} style={{ marginBottom: 12 }} />
      <Skeleton variant="rect" width="100%" height={80} style={{ marginBottom: 12 }} />
      <Skeleton variant="rect" width="60%" height={24} />
    </Box>
  );
}

/**
 * Main application router component.
 * Renders routes based on centralized configuration.
 */
export function AppRouter() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {routeConfig.map((route) => {
          const Component = route.component;
          const element = route.protected ? (
            <ProtectedRoute>
              <Component />
            </ProtectedRoute>
          ) : (
            <Component />
          );

          return <Route key={route.path} path={route.path} element={element} />;
        })}
        
        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
      </Routes>
    </Suspense>
  );
}

