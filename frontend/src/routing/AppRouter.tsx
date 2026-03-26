import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { routeConfig } from './routes';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './constants';

/**
 * Loading fallback component for lazy-loaded routes
 */
function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
      }}
    >
      <CircularProgress />
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

