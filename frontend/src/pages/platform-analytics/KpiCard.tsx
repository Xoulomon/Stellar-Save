import { Card, CardContent, Skeleton, Typography } from '@mui/material';

interface KpiCardProps {
  label: string;
  value: string;
  loading: boolean;
}

export function KpiCard({ label, value, loading }: KpiCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {loading ? (
          <Skeleton width="60%" height={36} />
        ) : (
          <Typography variant="h5" fontWeight="bold">
            {value}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
