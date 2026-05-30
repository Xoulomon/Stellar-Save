import { createTheme } from '@mui/material/styles';
import { themeTokens } from './tokens';

// ── Shared component overrides ────────────────────────────────────────────────

const sharedComponents = {
  MuiButton: {
    defaultProps: { variant: 'contained' as const, disableElevation: true },
    styleOverrides: {
      root: { borderRadius: 10, paddingInline: '1rem' },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { border: `1px solid ${themeTokens.palette.divider}` },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { backgroundColor: '#ffffff' },
    },
  },
};

// ── Light theme (default) ─────────────────────────────────────────────────────

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    ...themeTokens.palette,
    background: {
      default: '#edf4ff',
      paper: '#ffffff',
    },
    text: {
      primary: '#152247',
      secondary: '#4e5b82',
    },
  },
  shape: themeTokens.shape,
  spacing: themeTokens.spacing,
  typography: themeTokens.typography,
  components: sharedComponents,
});

// ── Dark theme ────────────────────────────────────────────────────────────────

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: themeTokens.palette.primary,
    secondary: themeTokens.palette.secondary,
    error: themeTokens.palette.error,
    background: {
      default: '#0d1117',
      paper: '#161b22',
    },
    text: {
      primary: '#e6edf3',
      secondary: '#8b949e',
    },
    divider: '#30363d',
  },
  shape: themeTokens.shape,
  spacing: themeTokens.spacing,
  typography: themeTokens.typography,
  components: {
    ...sharedComponents,
    MuiPaper: {
      styleOverrides: {
        root: { border: '1px solid #30363d' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#0d1117' },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...sharedOverrides,
  palette: {
    mode: "light",
    primary: themeTokens.palette.primary,
    secondary: themeTokens.palette.secondary,
    background: {
      default: "#edf4ff",
      paper: "#ffffff",
    },
    text: {
      primary: "#152247",
      secondary: "#4e5b82",
    },
    error: themeTokens.palette.error,
    divider: "#d6dbe8",
  },
});

// ── Legacy export (keeps existing imports working) ────────────────────────────
export const appTheme = lightTheme;
