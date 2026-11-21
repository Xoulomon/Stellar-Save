import { Box } from '@mui/material';

/**
 * Off-screen skip link that becomes visible on keyboard focus.
 */
export function SkipLink() {
  return (
  <Box
    component="a"
    href="#main-content"
    sx={{
      position: 'absolute',
      left: '-9999px',
      top: 'auto',
      width: 1,
      height: 1,
      overflow: 'hidden',
      '&:focus': {
        position: 'fixed',
        top: 8,
        left: 8,
        width: 'auto',
        height: 'auto',
        p: 1,
        background: 'primary.main',
        color: 'white',
        zIndex: 9999,
        borderRadius: 1,
      },
    }}
  >
    Skip to main content
  </Box>
  );
}
