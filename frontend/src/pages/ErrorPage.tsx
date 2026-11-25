import { Box, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { errorIllustration, OptimizedImage } from '../assets';
import { AppButton, AppCard } from '../ui';

export default function ErrorPage() {
  const handleRetryClick = () => {
    window.location.reload();
  };
  const navigate = useNavigate();
  const handleGoHome = () => {
    navigate('/');
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
      <AppCard
        sx={{
          maxWidth: 600,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <Stack spacing={0} alignItems="center">
          <OptimizedImage
            {...errorIllustration}
            style={{ width: '100%', maxWidth: 400 }}
          />

          <Box sx={{ position: 'relative', top: '-30px', textAlign: 'center' }}>
            <Typography variant="h2" gutterBottom>
              UPS... Something Went Wrong
            </Typography>

            <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
              An unexpected error has occurred. Please try again later.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <AppButton onClick={handleGoHome} size="large">
                Go to Home
              </AppButton>
              <AppButton onClick={handleRetryClick} size="large">
                Retry
              </AppButton>
            </Box>
          </Box>
        </Stack>
      </AppCard>
    </Box>
  );
}
