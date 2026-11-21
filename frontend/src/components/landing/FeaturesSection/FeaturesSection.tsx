import { Box, Container, Grid, Stack, Typography } from '@mui/material';

import { AppCard } from '@/ui/components/AppCard';

/**
 * Feature grid.
 */
export function FeaturesSection() {
  return (
    <Box
      component="section"
      id="features"
      aria-labelledby="features-heading"
      sx={{ py: { xs: 6, md: 10 } }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              fontSize: '0.875rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              mb: 1,
            }}
          >
            Why Choose Us
          </Typography>
          <Typography id="features-heading" variant="h1" sx={{ mb: 2 }}>
            Built for Trust and Transparency
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Stellar Save leverages blockchain technology to ensure every transaction is secure,
            transparent, and instant.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[
            {
              icon: '🔒',
              title: 'Secure & Transparent',
              desc: 'All contributions and payouts are recorded on-chain. Anyone can verify group status at any time.',
            },
            {
              icon: '⚡',
              title: 'Instant Transactions',
              desc: 'Stellar processes transactions in seconds with minimal fees — no waiting days for payments.',
            },
            {
              icon: '🪙',
              title: 'Multi-Token Support',
              desc: 'Save in XLM, USDC, EURC, or any SEP-41 token. Choose the currency that works for your group.',
            },
            {
              icon: '📊',
              title: 'Track Everything',
              desc: 'View contribution history, cycle progress, and upcoming payouts all in one dashboard.',
            },
            {
              icon: '🔔',
              title: 'Smart Notifications',
              desc: 'Get notified about upcoming contributions, payouts, and group status changes.',
            },
            {
              icon: '🌍',
              title: 'Global Access',
              desc: 'Anyone with a Stellar wallet can participate. No borders, no barriers.',
            },
          ].map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={feature.title}>
              <AppCard
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px rgba(31,79,212,0.1)',
                  },
                }}
              >
                <Stack spacing={2}>
                  <Typography sx={{ fontSize: '2.5rem' }} role="img" aria-label={feature.title}>
                    {feature.icon}
                  </Typography>
                  <Typography variant="h2">{feature.title}</Typography>
                  <Typography color="text.secondary">{feature.desc}</Typography>
                </Stack>
              </AppCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
