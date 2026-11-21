import { Box, Container, Grid, Stack, Typography } from '@mui/material';

import { AppCard } from '@/ui/components/AppCard';

/**
 * Social proof quotes.
 */
export function TestimonialsSection() {
  return (
    <Box
      component="section"
      id="testimonials"
      aria-labelledby="testimonials-heading"
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
            Testimonials
          </Typography>
          <Typography id="testimonials-heading" variant="h1" sx={{ mb: 2 }}>
            What Our Members Say
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[
            {
              name: 'Amara K.',
              location: 'Lagos, Nigeria',
              quote:
                "I've been part of traditional ajo groups my whole life. Stellar Save brings that same trust but with full transparency — I can see every transaction on-chain.",
              avatar: '🧑🏾',
            },
            {
              name: 'Sofia R.',
              location: 'Mexico City, Mexico',
              quote:
                'Our tanda group used to rely on trust alone. Now with Stellar Save, the smart contract handles everything automatically. No more disputes.',
              avatar: '👩🏽',
            },
            {
              name: 'James T.',
              location: 'London, UK',
              quote:
                'I joined a USDC savings circle with colleagues from 5 different countries. The multi-token support made it seamless for everyone.',
              avatar: '👨🏻',
            },
          ].map((t) => (
            <Grid size={{ xs: 12, md: 4 }} key={t.name}>
              <AppCard sx={{ height: '100%' }}>
                <Stack spacing={2}>
                  <Typography
                    sx={{ fontSize: '2rem' }}
                    role="img"
                    aria-label={`${t.name} avatar`}
                  >
                    {t.avatar}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', lineHeight: 1.7 }}
                  >
                    "{t.quote}"
                  </Typography>
                  <Box>
                    <Typography variant="h2" sx={{ fontSize: '1rem' }}>
                      {t.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t.location}
                    </Typography>
                  </Box>
                </Stack>
              </AppCard>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
