import { Box, Stack, Typography } from '@mui/material';
import { AppButton, AppCard } from '../ui';

/**
 * 404 Not Found page component
 * Displays when user navigates to an undefined route
 */
export default function NotFoundPage() {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 3,
      }}
    >
      <AppCard sx={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '4rem', sm: '6rem' },
              fontWeight: 700,
              color: 'primary.main',
              lineHeight: 1,
            }}
          >
            404
          </Typography>

          <Box>
            <Typography variant="h2" gutterBottom>
              Page Not Found
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              The page you're looking for doesn't exist or has been moved.
            </Typography>
          </Box>

          <AppButton onClick={handleGoHome} size="large">
            Go to Home
          </AppButton>
        </Stack>
      </AppCard>
    </Box>
  );
}
