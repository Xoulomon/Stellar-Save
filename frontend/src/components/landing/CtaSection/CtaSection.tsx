import { Box, Container, Stack, Typography, useTheme } from '@mui/material';

import { AppButton } from '@/ui/components/AppButton';

/**
 * Closing call to action.
 */
export function CtaSection() {
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-labelledby="cta-heading"
      sx={{
        py: { xs: 6, md: 10 },
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', p: { xs: 4, md: 6 } }}>
          <Stack spacing={3} alignItems="center">
            <Typography
              id="cta-heading"
              variant="h1"
              sx={{ color: 'white', fontSize: { xs: '2rem', md: '2.5rem' } }}
            >
              Ready to Start Saving?
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 420 }}>
              Join thousands of members already saving together. Connect your wallet to get
              started today.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
              <AppButton
                variant="contained"
                size="large"
                aria-label="Connect wallet to get started"
                sx={{
                  background: 'white',
                  color: 'primary.main',
                  '&:hover': { background: 'rgba(255,255,255,0.9)' },
                }}
              >
                Connect Wallet
              </AppButton>
              <AppButton
                variant="outlined"
                size="large"
                href="#features"
                aria-label="Learn more about Stellar Save features"
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': { background: 'rgba(255,255,255,0.1)' },
                }}
              >
                Learn More
              </AppButton>
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
