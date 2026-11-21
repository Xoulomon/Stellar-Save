import { Box, Typography } from '@mui/material';

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

/** Single headline metric in the platform health strip. */
export function StatCard({ label, value, sub, color = 'primary.main' }: StatCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        textTransform="uppercase"
        letterSpacing={0.5}
      >
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={800} color={color} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Box>
  );
}
