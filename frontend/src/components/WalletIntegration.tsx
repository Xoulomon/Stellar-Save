import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  Chip,
  Alert,
  Tooltip,
  IconButton,
  Divider,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { Button } from './Button';
import { useWallet } from '../hooks/useWallet';
import { useBalance } from '../hooks/useBalance';
import { useClipboard } from '../hooks/useClipboard';

// ── Wallet status indicator ──────────────────────────────────────────────────

interface StatusDotProps {
  status: 'idle' | 'connecting' | 'connected' | 'error';
}

function StatusDot({ status }: StatusDotProps) {
  const colors: Record<string, string> = {
    idle: '#9ca3af',
    connecting: '#f59e0b',
    connected: '#22c55e',
    error: '#ef4444',
  };
  const labels: Record<string, string> = {
    idle: 'Disconnected',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Error',
  };
  return (
    <Tooltip title={labels[status] ?? status} placement="bottom">
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          bgcolor: colors[status] ?? '#9ca3af',
          boxShadow: status === 'connected' ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
          animation: status === 'connecting' ? 'pulse 1.2s infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.4 },
          },
          flexShrink: 0,
        }}
        aria-label={`Wallet status: ${labels[status]}`}
      />
    </Tooltip>
  );
}

// ── Wallet selection dialog ──────────────────────────────────────────────────

interface WalletSelectionDialogProps {
  open: boolean;
  onClose: () => void;
}

function WalletSelectionDialog({ open, onClose }: WalletSelectionDialogProps) {
  const { wallets, selectedWalletId, status, error, connect, switchWallet } = useWallet();

  const handleSelect = async (walletId: string) => {
    if (walletId !== selectedWalletId) {
      await switchWallet(walletId);
    }
    await connect();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceWalletIcon fontSize="small" />
          Connect Wallet
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Select a wallet to connect to Stellar Save.
          </Typography>

          {wallets.map((wallet) => (
            <Box
              key={wallet.id}
              onClick={() => wallet.installed && void handleSelect(wallet.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                border: '1px solid',
                borderColor: selectedWalletId === wallet.id ? 'primary.main' : 'divider',
                borderRadius: 2,
                cursor: wallet.installed ? 'pointer' : 'not-allowed',
                opacity: wallet.installed ? 1 : 0.5,
                bgcolor: selectedWalletId === wallet.id ? 'action.selected' : 'transparent',
                '&:hover': wallet.installed ? { bgcolor: 'action.hover' } : {},
                transition: 'all 0.2s',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AccountBalanceWalletIcon color={wallet.installed ? 'primary' : 'disabled'} />
                <Box>
                  <Typography variant="body1" fontWeight={600}>{wallet.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {wallet.installed ? 'Installed' : 'Not installed — install the browser extension'}
                  </Typography>
                </Box>
              </Stack>
              {status === 'connecting' && selectedWalletId === wallet.id ? (
                <CircularProgress size={18} />
              ) : wallet.installed ? (
                <Chip label="Connect" size="small" color="primary" variant="outlined" />
              ) : (
                <Chip label="Install" size="small" variant="outlined" />
              )}
            </Box>
          ))}

          <Divider />
          <Typography variant="caption" color="text.secondary" textAlign="center">
            By connecting, you agree to interact with the Stellar network.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ── Connected wallet panel ───────────────────────────────────────────────────

interface ConnectedPanelProps {
  address: string;
  network: string | null;
  onDisconnect: () => void;
  onSwitchAccount: (addr: string) => void;
  connectedAccounts: string[];
}

function ConnectedPanel({ address, network, onDisconnect, onSwitchAccount, connectedAccounts }: ConnectedPanelProps) {
  const { xlmBalance, isLoading: balanceLoading } = useBalance();
  const { copy, copied } = useClipboard();

  return (
    <Stack spacing={2}>
      {/* Network badge */}
      {network && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusDot status="connected" />
          <Chip label={network} size="small" color="success" variant="outlined" />
        </Box>
      )}

      {/* Address */}
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
          Wallet Address
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, fontSize: '0.75rem' }}
          >
            {address}
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
            <IconButton size="small" onClick={() => copy(address)} aria-label="Copy wallet address">
              {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Balance */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">Balance</Typography>
        {balanceLoading ? (
          <CircularProgress size={14} />
        ) : (
          <Typography variant="body2" fontWeight={700}>{xlmBalance ?? '—'} XLM</Typography>
        )}
      </Box>

      {/* Multi-account switcher */}
      {connectedAccounts.length > 1 && (
        <>
          <Divider />
          <Typography variant="caption" color="text.secondary">Switch Account</Typography>
          <Stack spacing={0.5}>
            {connectedAccounts.map((acc) => (
              <Box
                key={acc}
                onClick={() => onSwitchAccount(acc)}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: acc === address ? 'action.selected' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {acc === address && <CheckCircleIcon fontSize="small" color="primary" />}
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {acc.slice(0, 8)}…{acc.slice(-6)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}

      <Divider />
      <Button variant="secondary" onClick={onDisconnect}>Disconnect Wallet</Button>
    </Stack>
  );
}

// ── Main WalletIntegration component ────────────────────────────────────────

/**
 * WalletIntegration — Issue #443
 * Full wallet integration UI:
 * - Wallet connection with selection dialog
 * - Wallet status indicator (idle / connecting / connected / error)
 * - Connected wallet panel: address, balance, network, copy address
 * - Multi-account switcher
 * - Wallet disconnection
 * - Error handling and display
 * - Stores wallet address in context (WalletProvider)
 */
export function WalletIntegration() {
  const {
    status,
    activeAddress,
    network,
    error,
    connectedAccounts,
    disconnect,
    switchAccount,
  } = useWallet();

  const [selectionOpen, setSelectionOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Auto-close panel on disconnect
  useEffect(() => {
    if (status === 'idle') setPanelOpen(false);
  }, [status]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setPanelOpen(false);
  }, [disconnect]);

  // ── Not connected ──
  if (status !== 'connected' || !activeAddress) {
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatusDot status={status} />
          {error && (
            <Tooltip title={error}>
              <ErrorIcon fontSize="small" color="error" />
            </Tooltip>
          )}
          <Button
            onClick={() => setSelectionOpen(true)}
            loading={status === 'connecting'}
            disabled={status === 'connecting'}
            variant="primary"
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect Wallet'}
          </Button>
        </Box>

        <WalletSelectionDialog
          open={selectionOpen}
          onClose={() => setSelectionOpen(false)}
        />
      </>
    );
  }

  // ── Connected ──
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <StatusDot status="connected" />
        <Button
          variant="secondary"
          onClick={() => setPanelOpen(true)}
          aria-label="Wallet options"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWalletIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
            </Typography>
          </Box>
        </Button>
      </Box>

      {/* Connected wallet panel dialog */}
      <Dialog open={panelOpen} onClose={() => setPanelOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StatusDot status="connected" />
            Wallet Connected
          </Box>
        </DialogTitle>
        <DialogContent>
          <ConnectedPanel
            address={activeAddress}
            network={network}
            onDisconnect={handleDisconnect}
            onSwitchAccount={(addr) => { switchAccount(addr); setPanelOpen(false); }}
            connectedAccounts={connectedAccounts}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WalletIntegration;
