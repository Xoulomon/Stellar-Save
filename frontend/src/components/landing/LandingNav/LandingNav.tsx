import { Box, Container, Stack, Typography, useTheme } from '@mui/material';

import { AppButton } from '@/ui/components/AppButton';
import type { LandingNavLink } from './types';

const navigationLinks: LandingNavLink[] = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Testimonials', href: '#testimonials' },
];

/**
 * Sticky banner with the primary navigation and wallet connect action.
 */
export function LandingNav() {
  const theme = useTheme();

  return (
  <Box
    component="header"
    role="banner"
    sx={{
      py: 2,
      px: 3,
      borderBottom: `1px solid ${theme.palette.divider}`,
      background: theme.palette.background.paper,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}
  >
    <Container maxWidth="lg">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          variant="h2"
          sx={{ color: 'primary.main', fontWeight: 700 }}
          aria-label="Stellar Save home"
        >
          Stellar Save
        </Typography>
        <Stack component="nav" aria-label="Main navigation" direction="row" spacing={2}>
          {navigationLinks.map(({ label, href }) => (
            <AppButton key={href} variant="text" size="small" href={href}>
              {label}
            </AppButton>
          ))}
          <AppButton variant="outlined" size="small" aria-label="Connect your Stellar wallet">
            Connect Wallet
          </AppButton>
        </Stack>
      </Stack>
    </Container>
  </Box>
  );
}
