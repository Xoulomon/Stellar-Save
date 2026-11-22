import { Box, Container, Grid, Typography, useTheme } from '@mui/material';

/**
 * Numbered walkthrough of joining and contributing.
 */
export function HowItWorksSection() {
  const theme = useTheme();

  return (
    <Box
      component="section"
      id="how-it-works"
      aria-labelledby="how-heading"
      sx={{ py: { xs: 6, md: 10 }, background: theme.palette.background.paper }}
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
            How It Works
          </Typography>
          <Typography id="how-heading" variant="h1" sx={{ mb: 2 }}>
            Simple Steps to Start Saving
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Connect your wallet, find a group, and start your journey to financial freedom.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {[
            {
              step: '01',
              icon: '🔗',
              title: 'Connect Wallet',
              desc: 'Link your Stellar wallet using Freighter or another supported wallet.',
            },
            {
              step: '02',
              icon: '👥',
              title: 'Join or Create Group',
              desc: 'Browse existing groups or create your own with custom settings and token.',
            },
            {
              step: '03',
              icon: '💰',
              title: 'Make Contributions',
              desc: 'Contribute your agreed amount each cycle. All transactions are on-chain.',
            },
            {
              step: '04',
              icon: '🎁',
              title: 'Receive Payout',
              desc: "When it's your turn, receive the complete pool instantly to your wallet.",
            },
          ].map((step) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={step.step}>
              <Box
                sx={{ textAlign: 'center', p: 3, position: 'relative' }}
                aria-label={`Step ${step.step}: ${step.title}`}
              >
                <Typography
                  aria-hidden="true"
                  sx={{
                    fontSize: '4rem',
                    fontWeight: 800,
                    color: 'primary.light',
                    opacity: 0.2,
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  {step.step}
                </Typography>
                <Box sx={{ position: 'relative', pt: 4 }}>
                  <Typography
                    sx={{ fontSize: '3rem', mb: 2 }}
                    role="img"
                    aria-label={step.title}
                  >
                    {step.icon}
                  </Typography>
                  <Typography variant="h2" sx={{ mb: 1 }}>
                    {step.title}
                  </Typography>
                  <Typography color="text.secondary">{step.desc}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
