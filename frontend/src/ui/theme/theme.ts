import { createTheme } from "@mui/material";
import type { Theme } from "@mui/material";
import { themeTokens } from "./tokens";

const sharedOverrides = {
  shape: themeTokens.shape,
  spacing: themeTokens.spacing,
  typography: themeTokens.typography,
  components: {
    MuiButton: {
      defaultProps: {
        variant: "contained" as const,
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: "1rem",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }: { theme: Theme }) => ({
          backgroundColor: theme.palette.background.paper,
        }),
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

export const darkTheme = createTheme({
  ...sharedOverrides,
  palette: {
    mode: "dark",
    primary: {
      main: "#5d8cf2",
      dark: "#3a6ad4",
      light: "#8fb3ff",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#49bcb9",
      dark: "#008f8c",
      light: "#7dd8d6",
      contrastText: "#ffffff",
    },
    background: {
      default: "#0f1623",
      paper: "#1a2236",
    },
    text: {
      primary: "#e8edf8",
      secondary: "#9aaac8",
    },
    error: {
      main: "#f47a8a",
    },
    divider: "#2a3550",
  },
});

/** @deprecated Use lightTheme or darkTheme directly */
export const appTheme = lightTheme;
