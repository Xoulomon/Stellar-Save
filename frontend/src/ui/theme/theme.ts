import { createTheme } from "@mui/material/styles";
import { themeTokens } from "./tokens";

export const appTheme = createTheme({
  palette: themeTokens.palette,
  shape: themeTokens.shape,
  spacing: themeTokens.spacing,
  typography: themeTokens.typography,
  components: {
    MuiButton: {
      defaultProps: {
        variant: "contained",
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
        root: {
          border: `1px solid ${themeTokens.palette.divider}`,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
        },
      },
    },
  },
});
