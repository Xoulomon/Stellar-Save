import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  CircularProgress,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Link,
} from '@mui/material';
import { useWallet } from '../hooks/useWallet';
import { useBackendAuth } from '../hooks/useBackendAuth';
import { useRamp, useRampTransactionPoller } from '../hooks/useRamp';
import type { RampTransaction, RampTransactionType } from '../types/ramp';

export interface FiatRampScreenProps {
  type: RampTransactionType;
  title: string;
  description: string;
  defaultAsset?: string;
}

export function FiatRampScreen({ type, title, description, defaultAsset = 'USDC' }: FiatRampScreenProps) {
  const { activeAddress } = useWallet();
  const { isAuthenticated, isAuthenticating, error: authError, authenticate } = useBackendAuth();
  const { initiateDeposit, initiateWithdraw, getTransaction } = useRamp();

  const [anchorDomain, setAnchorDomain] = useState('testanchor.stellar.org');
  const [assetCode, setAssetCode] = useState(defaultAsset);
  const [assetIssuer, setAssetIssuer] = useState('');
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState<RampTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const polled = useRampTransactionPoller(submitted?.id ?? null);

  const handleAuthAndStart = async () => {
    setError(null);
    if (!isAuthenticated) {
      try {
        await authenticate();
      } catch {
        setError('Authentication failed. Please try again.');
        return;
      }
    }
    startFlow();
  };

  const startFlow = async () => {
    if (!activeAddress) {
      setError('Connect your wallet to continue.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const init = type === 'deposit' ? initiateDeposit : initiateWithdraw;
      const result = await init({
        anchorDomain: anchorDomain.trim(),
        assetCode: assetCode.trim(),
        assetIssuer: assetIssuer.trim() || undefined,
        amount: amount.trim() || undefined,
        stellarAccount: activeAddress,
      });
      const record = await getTransaction(result.id);
      if (record) setSubmitted(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start flow');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExternal = () => {
    const url = polled?.interactiveUrl ?? submitted?.interactiveUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const statusColor = (s: string) => {
    if (s === 'completed') return 'success';
    if (s === 'error' || s === 'expired' || s === 'refunded') return 'error';
    return 'info';
  };

  const current = polled ?? submitted;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {description}
      </Typography>

      {authError && <Alert severity="error" sx={{ mb: 2 }}>{authError}</Alert>}

      {!current && (
        <Stack spacing={2}>
          <TextField
            label="Anchor domain"
            value={anchorDomain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnchorDomain(e.target.value)}
            size="small"
            fullWidth
            helperText="Example: testanchor.stellar.org"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Asset</InputLabel>
              <Select value={assetCode} label="Asset" onChange={(e) => setAssetCode(e.target.value)}>
                <MenuItem value="USDC">USDC</MenuItem>
                <MenuItem value="XLM">XLM</MenuItem>
                <MenuItem value="EURC">EURC</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Asset issuer (optional)"
              value={assetIssuer}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssetIssuer(e.target.value)}
              size="small"
              fullWidth
              helperText="Leave empty for native XLM"
            />
          </Box>
          <TextField
            label={`Amount (${assetCode})`}
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            size="small"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={handleAuthAndStart}
            disabled={loading || isAuthenticating || !anchorDomain.trim() || !assetCode.trim()}
            startIcon={isAuthenticating || loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {!isAuthenticated ? 'Connect & Authenticate' : type === 'deposit' ? 'Start Deposit' : 'Start Withdrawal'}
          </Button>
        </Stack>
      )}

      {current && (
        <Stack spacing={2}>
          <Alert severity={statusColor(current.status) as 'success' | 'error' | 'info'}>
            <Typography fontWeight={600} sx={{ textTransform: 'capitalize' }}>
              {current.status.replace(/_/g, ' ')}
            </Typography>
            {current.status === 'completed' && (
              <Typography variant="caption" display="block">
                Your {type} has been processed successfully.
              </Typography>
            )}
          </Alert>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Asset: ${current.assetCode}`} size="small" />
            {current.amount && <Chip label={`Amount: ${current.amount}`} size="small" />}
            <Chip label={`Anchor: ${current.anchorDomain}`} size="small" />
          </Box>

          {current.interactiveUrl && current.status !== 'completed' && (
            <Button variant="outlined" onClick={handleOpenExternal}>
              Open {type === 'deposit' ? 'deposit' : 'withdrawal'} page
            </Button>
          )}

          {current.moreInfoUrl && (
            <Link href={current.moreInfoUrl} target="_blank" rel="noopener noreferrer" variant="body2">
              More info
            </Link>
          )}

          <Divider />

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              Started {new Date(current.startedAt).toLocaleString()}
            </Typography>
            <Button size="small" onClick={() => { setSubmitted(null); }}>New {type}</Button>
          </Stack>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
}
