import { useState } from 'react';
import { Alert, AlertTitle, Box, Button, Collapse, Link, Stack, Typography } from '@mui/material';
import type { BalanceWarning } from '../hooks/useBalanceWarning';

interface Props {
  warning: BalanceWarning;
}

/**
 * Dismissible banner shown on the dashboard when the wallet balance is
 * insufficient to cover upcoming group contributions.
 */
export function BalanceWarningBanner({ warning }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!warning.isInsufficient || dismissed) return null;

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });

  return (
    <Collapse in>
      <Alert
        severity="warning"
        sx={{ borderRadius: 2, mb: 2 }}
        action={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              component={Link}
              href="https://www.stellar.org/lumens/wallets"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Fund Wallet
            </Button>
            <Button
              size="small"
              aria-label="dismiss warning"
              onClick={() => setDismissed(true)}
              sx={{ minWidth: 0, px: 1 }}
            >
              ✕
            </Button>
          </Stack>
        }
      >
        <AlertTitle sx={{ fontWeight: 'bold' }}>Insufficient Balance</AlertTitle>
        <Box>
          <Typography variant="body2">
            Your wallet has{' '}
            <strong>{fmt(warning.currentBalance)} XLM</strong> but your upcoming
            contributions require{' '}
            <strong>{fmt(warning.requiredAmount)} XLM</strong>.
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            You need <strong>{fmt(warning.shortfall)} more XLM</strong> to cover
            all active group contributions.
          </Typography>
        </Box>
      </Alert>
    </Collapse>
  );
}
