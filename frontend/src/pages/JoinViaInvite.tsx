import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Stack, CircularProgress, Alert } from '@mui/material';
import { Button } from '../components/Button';
import { useWallet } from '../hooks/useWallet';
import { buildRoute } from '../routing/constants';

/**
 * JoinViaInvite — handles /join?groupId=<id> invite links.
 * Reads the groupId query param, prompts the user to join, and
 * calls join_group on confirmation.
 */
const JoinViaInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeAddress, status: walletStatus } = useWallet();

  const groupId = searchParams.get('groupId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  if (!groupId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 3 }}>
        <Alert severity="error">Invalid invite link — no group ID found.</Alert>
      </Box>
    );
  }

  const handleJoin = async () => {
    if (walletStatus !== 'connected' || !activeAddress) {
      setError('Please connect your wallet first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: replace with real contract call once contractClient is wired up
      // await joinGroup({ groupId: Number(groupId), member: activeAddress });
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setJoined(true);
      setTimeout(() => navigate(buildRoute.groupDetail(groupId)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
        p: 3,
        textAlign: 'center',
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ color: 'var(--mui-palette-primary-main, #1976d2)' }}
        aria-hidden="true"
      >
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>

      <Stack spacing={1}>
        <Typography variant="h5" fontWeight="bold">
          You've been invited!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Join savings group <strong>{groupId}</strong> on Stellar Save.
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ width: '100%', maxWidth: 400 }}>{error}</Alert>}

      {joined ? (
        <Alert severity="success" sx={{ width: '100%', maxWidth: 400 }}>
          Joined successfully! Redirecting to group…
        </Alert>
      ) : (
        <Stack direction="row" spacing={2}>
          <Button
            variant="primary"
            onClick={handleJoin}
            disabled={loading}
            aria-label="Join group"
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Join Group'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Stack>
      )}

      {walletStatus !== 'connected' && !joined && (
        <Typography variant="caption" color="text.secondary">
          Connect your wallet to join this group.
        </Typography>
      )}
    </Box>
  );
};

export default JoinViaInvite;
