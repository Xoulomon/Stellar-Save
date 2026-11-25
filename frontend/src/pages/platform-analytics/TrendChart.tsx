import { Box, Typography } from '@mui/material';

import type { TrendPoint } from './types';

interface TrendChartProps {
  data: TrendPoint[];
  field: keyof TrendPoint;
  label: string;
  color: string;
}

export function TrendChart({ data, field, label, color }: TrendChartProps) {
  if (!data.length) return null;
  const values = data.map((point) => Number(point[field]) || 0);
  const max = Math.max(...values, 1);
  const width = 480;
  const height = 120;
  const step = width / Math.max(data.length - 1, 1);

  const points = values
    .map((value, index) => `${index * step},${height - (value / max) * height}`)
    .join(' ');

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height + 20}`}
          style={{ width: '100%', minWidth: 280 }}
          aria-label={`${label} trend`}
        >
          <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
          {values.map((value, index) => (
            <circle
              key={index}
              cx={index * step}
              cy={height - (value / max) * height}
              r={3}
              fill={color}
            >
              <title>{`${data[index].date ?? index}: ${value.toLocaleString()}`}</title>
            </circle>
          ))}
        </svg>
      </Box>
    </Box>
  );
}
