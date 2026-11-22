import { Box, Container, Grid, Stack, Typography, useTheme } from '@mui/material';

import { AppButton } from '@/ui/components/AppButton';

/**
 * Above-the-fold headline and primary calls to action.
 */
export function HeroSection() {
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-labelledby="hero-heading"
      sx={{
        py: { xs: 8, md: 14 },
        background: `linear-gradient(160deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <Typography
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Community Savings on Stellar
              </Typography>
              <Typography
                id="hero-heading"
                variant="h1"
                sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.1 }}
              >
                Save Together,
                <br />
                Win Together
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: '1rem', md: '1.125rem' },
                  maxWidth: 480,
                }}
              >
                Join community savings circles (ROSCAs) where everyone contributes equally and
                takes turns receiving the pool — built on Stellar for transparent, secure, and
                instant transactions.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                <AppButton
                  variant="contained"
                  size="large"
                  aria-label="Get started with Stellar Save"
                >
                  Get Started
                </AppButton>
                <AppButton
                  variant="outlined"
                  size="large"
                  href="#how-it-works"
                  aria-label="Learn how Stellar Save works"
                >
                  How It Works
                </AppButton>
              </Stack>
              <Stack
                direction="row"
                spacing={4}
                sx={{ pt: 2 }}
                role="list"
                aria-label="Platform statistics"
              >
                {[
                  { value: '2.5M+', label: 'Total Saved' },
                  { value: '10K+', label: 'Active Groups' },
                  { value: '50K+', label: 'Members' },
                ].map((stat) => (
                  <Box key={stat.label} role="listitem">
                    <Typography variant="h2" sx={{ color: 'primary.main' }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.label}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                p: 4,
                background: theme.palette.background.paper,
                borderRadius: 3,
                boxShadow: '0 20px 60px rgba(31,79,212,0.12)',
                maxWidth: 360,
                mx: 'auto',
                textAlign: 'center',
              }}
              aria-label="Example savings circle preview"
            >
              <Typography sx={{ fontSize: '4rem', mb: 2 }} role="img" aria-label="Money bag">
                💰
              </Typography>
              <Typography variant="h2" gutterBottom>
                Savings Circle
              </Typography>
              <Typography color="text.secondary">
                5 members · 500 XLM each · 3-month cycle
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="center"
                sx={{ mt: 2 }}
                role="list"
                aria-label="Member contribution status"
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <Box
                    key={i}
                    role="listitem"
                    aria-label={i <= 2 ? `Member ${i} contributed` : `Member ${i} pending`}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: i <= 2 ? theme.palette.primary.main : theme.palette.divider,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: i <= 2 ? 'white' : 'text.secondary',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {i <= 2 ? '✓' : i}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
