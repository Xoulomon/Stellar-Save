import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useWallet } from '../hooks/useWallet';
import { useClipboard } from '../hooks/useClipboard';

/**
 * WalletStatusIndicator — Persistent wallet connection status display
 * Shows connection state, network, address with copy, and connection strength
 */
export function WalletStatusIndicator() {
  const { status, activeAddress, network, error } = useWallet();
  const { copy, copied } = useClipboard();
  const [latency, setLatency] = useState<number | null>(null);
  const [isMeasuringLatency, setIsMeasuringLatency] = useState(false);

  // Measure connection latency to Stellar network
  useEffect(() => {
    if (status !== 'connected' || !network) {
      setLatency(null);
      return;
    }

    const measureLatency = async () => {
      setIsMeasuringLatency(true);
      try {
        const start = Date.now();
        // Simple ping to Stellar network endpoint
        const response = await fetch(`https://horizon${network === 'mainnet' ? '' : '-testnet'}.stellar.org/`);
        const end = Date.now();
        if (response.ok) {
          setLatency(end - start);
        } else {
          setLatency(null);
        }
      } catch {
        setLatency(null);
      } finally {
        setIsMeasuringLatency(false);
      }
    };

    measureLatency();
    // Measure every 30 seconds
    const interval = setInterval(measureLatency, 30000);
    return () => clearInterval(interval);
  }, [status, network]);

  const getConnectionStrength = (latencyMs: number | null): 'excellent' | 'good' | 'poor' | 'offline' => {
    if (latencyMs === null) return 'offline';
    if (latencyMs < 200) return 'excellent';
    if (latencyMs < 500) return 'good';
    return 'poor';
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'excellent': return '#22c55e';
      case 'good': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#9ca3af';
    }
  };

  const getStrengthLabel = (strength: string) => {
    switch (strength) {
      case 'excellent': return 'Excellent (<200ms)';
      case 'good': return 'Good (200-500ms)';
      case 'poor': return 'Poor (>500ms)';
      default: return 'Offline';
    }
  };

  if (status === 'idle') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WifiOffIcon sx={{ color: '#9ca3af', fontSize: 18 }} />
        <Typography variant="body2" color="text.secondary">
          Wallet disconnected
        </Typography>
      </Box>
    );
  }

  if (status === 'connecting') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          Connecting wallet...
        </Typography>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ErrorIcon sx={{ color: '#ef4444', fontSize: 18 }} />
        <Typography variant="body2" color="error">
          Connection error
        </Typography>
        {error && (
          <Tooltip title={error}>
            <Typography variant="caption" color="error" sx={{ cursor: 'help' }}>
              ?
            </Typography>
          </Tooltip>
        )}
      </Box>
    );
  }

  // Connected state
  const strength = getConnectionStrength(latency);
  const strengthColor = getStrengthColor(strength);

  return (
    <Stack spacing={1} sx={{ minWidth: 280 }}>
      {/* Status row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
        <Chip
          label={network || 'unknown'}
          size="small"
          variant="outlined"
          color="success"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isMeasuringLatency ? (
            <CircularProgress size={14} />
          ) : (
            <WifiIcon sx={{ color: strengthColor, fontSize: 16 }} />
          )}
          <Tooltip title={getStrengthLabel(strength)}>
            <Typography variant="caption" sx={{ color: strengthColor, cursor: 'help' }}>
              {latency ? `${latency}ms` : '—'}
            </Typography>
          </Tooltip>
        </Box>
      </Box>

      {/* Address row */}
      {activeAddress && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            {activeAddress.slice(0, 8)}…{activeAddress.slice(-6)}
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
            <IconButton
              size="small"
              onClick={() => copy(activeAddress)}
              sx={{ p: 0.5 }}
            >
              {copied ? (
                <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Stack>
  );
}