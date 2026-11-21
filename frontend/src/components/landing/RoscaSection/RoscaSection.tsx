import { Box, Container, Grid, Typography, useTheme } from '@mui/material';

/**
 * Explains the rotating savings concept with an illustration.
 */
export function RoscaSection() {
  const theme = useTheme();

  return (
    <Box
      component="section"
      id="rosca"
      aria-labelledby="rosca-heading"
      sx={{ py: { xs: 6, md: 10 }, background: theme.palette.background.paper }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
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
            What is a ROSCA?
          </Typography>
          <Typography id="rosca-heading" variant="h1" sx={{ mb: 2 }}>
            Rotating Savings & Credit Association
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontSize: '1.1rem', maxWidth: 600, mx: 'auto' }}
          >
            A ROSCA is a trusted community savings model used by millions worldwide. A group of
            people agree to contribute a fixed amount each cycle. Each cycle, one member
            receives the entire pool — rotating until everyone has received their payout.
          </Typography>
        </Box>
        <Grid container spacing={3} justifyContent="center">
          {[
            {
              icon: '🤝',
              title: 'Trusted by Communities',
              desc: 'ROSCAs have been used for centuries across Africa, Asia, Latin America, and beyond.',
            },
            {
              icon: '🔄',
              title: 'Rotating Payouts',
              desc: 'Every member contributes each cycle. Every member receives the pool exactly once.',
            },
            {
              icon: '🔗',
              title: 'Now On-Chain',
              desc: 'Stellar Save brings this proven model on-chain — transparent, automated, and trustless.',
            },
          ].map((item) => (
            <Grid size={{ xs: 12, sm: 4 }} key={item.title}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography
                  sx={{ fontSize: '2.5rem', mb: 1 }}
                  role="img"
                  aria-label={item.title}
                >
                  {item.icon}
                </Typography>
                <Typography variant="h2" sx={{ mb: 1 }}>
                  {item.title}
                </Typography>
                <Typography color="text.secondary">{item.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
