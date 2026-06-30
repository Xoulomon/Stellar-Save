/**
 * StaleDataBanner.tsx — Shows warning when viewing stale/cached data
 */

import { Alert, AlertTitle, Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';

interface StaleDataBannerProps {
  isStale?: boolean;
  fromCache?: boolean;
  onRefresh?: () => void;
}

export function StaleDataBanner({
  isStale,
  fromCache,
  onRefresh,
}: StaleDataBannerProps): JSX.Element | null {
  if (!fromCache && !isStale) return null;

  return (
    <Alert
      severity={isStale ? 'warning' : 'info'}
      sx={{ mb: 2 }}
      action={
        onRefresh ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<Refresh />}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>
        {isStale ? 'Viewing Stale Data' : 'Viewing Cached Data'}
      </AlertTitle>
      {isStale
        ? 'This data may be outdated. Connect to the internet to get the latest updates.'
        : 'You are viewing cached data. Some information may not be up to date.'}
    </Alert>
  );
}
