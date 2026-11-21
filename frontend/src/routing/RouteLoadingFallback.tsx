/**
 * RouteLoadingFallback — shared Suspense fallback.
 *
 * Previously duplicated: `App.tsx` and `routing/AppRouter.tsx` each defined
 * their own `RouteLoadingFallback`, with different markup and different
 * accessibility affordances. This is the single implementation used by both
 * the app-shell boundary (lazy `AppRouter`) and the per-route boundary (lazy
 * page chunks), so the loading experience is consistent across the app.
 *
 * The `role="status"` + `aria-label` pairing announces the pending state to
 * assistive technology, which the previous `App.tsx` variant did not do.
 */
import { Box } from '@mui/material';

import { Skeleton } from '../components/Skeleton/Skeleton';

/** Skeleton fallback shown while a lazy route chunk is downloading. */
export function RouteLoadingFallback() {
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

export default RouteLoadingFallback;
