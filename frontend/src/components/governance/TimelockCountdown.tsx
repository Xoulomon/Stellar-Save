import LockClockIcon from '@mui/icons-material/LockClock';
import { Box, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

/** Render a millisecond duration as `2d 4h` / `3h 12m` / `45m 9s`. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Elapsed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(s % 60)}s`;
}

export interface TimelockCountdownProps {
  endsAt: number;
}

/** Live countdown until a passed proposal's timelock expires. */
export function TimelockCountdown({ endsAt }: TimelockCountdownProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = endsAt - now;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
      <LockClockIcon fontSize="small" color="warning" />
      <Typography variant="body2" color="warning.main" fontWeight={600}>
        Timelock:{' '}
        {remaining > 0 ? `${formatCountdown(remaining)} remaining` : 'Unlocked — ready to execute'}
      </Typography>
    </Box>
  );
}
