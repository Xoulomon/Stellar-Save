export const themeTokens = {
  palette: {
    primary: {
      main: "#1f4fd4",
      dark: "#173b9f",
      light: "#5d8cf2",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#008f8c",
      dark: "#006665",
      light: "#49bcb9",
      contrastText: "#ffffff",
    },
    background: {
      default: "#edf4ff",
      paper: "#ffffff",
    },
    text: {
      primary: "#152247",
      secondary: "#4e5b82",
    },
    error: {
      main: "#b32042",
    },
    divider: "#d6dbe8",
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  typography: {
    fontFamily: [
      '"Segoe UI"',
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: {
      fontSize: "1.85rem",
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: "1.35rem",
      fontWeight: 700,
      lineHeight: 1.2,
    },
    button: {
      textTransform: "none" as const,
      fontWeight: 600,
    },
  },
} as const;
