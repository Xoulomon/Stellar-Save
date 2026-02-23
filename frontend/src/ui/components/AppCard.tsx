import { Paper, type PaperProps } from "@mui/material";

export type AppCardProps = PaperProps;

export function AppCard({ children, sx, ...props }: AppCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 3, borderRadius: 2, ...sx }}
      {...props}
    >
      {children}
    </Paper>
  );
}
