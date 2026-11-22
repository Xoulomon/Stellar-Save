import { Box, Container, Stack, Typography, useTheme } from '@mui/material';

/**
 * Site footer links.
 */
export function LandingFooter() {
  const theme = useTheme();

  return (
  <Box
    component="footer"
    role="contentinfo"
    sx={{
      py: 4,
      px: 3,
      background: theme.palette.background.paper,
      borderTop: `1px solid ${theme.palette.divider}`,
    }}
  >
    <Container maxWidth="lg">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
      >
        <Typography variant="body2" color="text.secondary">
          © 2024 Stellar Save. Built on Stellar.
        </Typography>
        <Stack component="nav" aria-label="Footer navigation" direction="row" spacing={3}>
          {['Terms', 'Privacy', 'Docs'].map((link) => (
            <Typography
              key={link}
              component="a"
              href="#"
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
            >
              {link}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Container>
  </Box>
  );
}
