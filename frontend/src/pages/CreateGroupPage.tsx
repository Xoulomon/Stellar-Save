import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stack, Typography, Alert, Box } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { ToastProvider } from '../components/Toast/ToastProvider';
import { useToast } from '../components/Toast/useToast';
import { useWallet } from '../hooks/useWallet';
import { createGroup, parseContractError } from '../lib/contractClient';
import type { GroupData } from '../utils/groupApi';
import { ROUTES, buildRoute } from '../routing/constants';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

function CreateGroupContent() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { status: walletStatus, activeAddress, connect } = useWallet();

  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  // Redirect to group detail after successful creation
  useEffect(() => {
    if (submitStatus !== 'success') return;
    const t = setTimeout(() => {
      navigate(createdGroupId ? buildRoute.groupDetail(createdGroupId) : ROUTES.GROUPS);
    }, 2500);
    return () => clearTimeout(t);
  }, [submitStatus, createdGroupId, navigate]);

  const handleSubmit = async (data: GroupData) => {
    // Wallet must be connected
    if (walletStatus !== 'connected' || !activeAddress) {
      setErrorMessage('Please connect your Freighter wallet before creating a group.');
      return;
    }

    setSubmitStatus('loading');
    setErrorMessage(null);

    try {
      const groupId = await createGroup({
        creator: activeAddress,
        contributionAmount: BigInt(data.contribution_amount), // already in stroops
        cycleDuration: BigInt(data.cycle_duration),
        maxMembers: data.max_members,
      });

      const groupIdStr = groupId.toString();
      setCreatedGroupId(groupIdStr);
      setSubmitStatus('success');

      addToast({
        message: `Group "${data.name}" created! Group ID: ${groupIdStr}`,
        type: 'success',
        duration: 6000,
      });
    } catch (err) {
      const contractErr = parseContractError(err);

      // Map known rejection/funds errors to friendly messages
      let msg = contractErr.message;
      if (msg.toLowerCase().includes('user declined') || msg.toLowerCase().includes('rejected')) {
        msg = 'Transaction rejected. You cancelled the signing request in Freighter.';
      } else if (msg.toLowerCase().includes('insufficient')) {
        msg = 'Insufficient funds. Please ensure your wallet has enough XLM to cover the transaction fee.';
      }

      setErrorMessage(msg);
      setSubmitStatus('error');
      addToast({ message: msg, type: 'error', duration: 6000 });
    }
  };

  const isWalletConnected = walletStatus === 'connected' && Boolean(activeAddress);

  return (
    <AppCard>
      <Stack spacing={3}>
        {/* Wallet connection warning */}
        {!isWalletConnected && (
          <Alert
            severity="warning"
            action={
              <Box
                component="button"
                onClick={connect}
                sx={{ cursor: 'pointer', fontWeight: 'bold', background: 'none', border: 'none', color: 'warning.dark', fontSize: '0.85rem' }}
              >
                Connect Wallet
              </Box>
            }
          >
            Connect your Freighter wallet to deploy a group on-chain.
          </Alert>
        )}

        {/* Success state */}
        {submitStatus === 'success' ? (
          <Stack spacing={1} alignItems="center" sx={{ py: 4 }}>
            <Typography variant="h5" fontWeight="bold" color="success.main">
              Group Created!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Redirecting to your group...
            </Typography>
          </Stack>
        ) : (
          <>
            {/* Inline error (also shown as toast) */}
            {submitStatus === 'error' && errorMessage && (
              <Alert severity="error" onClose={() => setErrorMessage(null)}>
                {errorMessage}
              </Alert>
            )}

            <CreateGroupForm
              onSubmit={handleSubmit}
              onCancel={() => navigate(ROUTES.GROUPS)}
              isSubmitting={submitStatus === 'loading'}
            />
          </>
        )}
      </Stack>
    </AppCard>
  );
}

export default function CreateGroupPage() {
  return (
    <ToastProvider>
      <AppLayout
        title="Create Group"
        subtitle="Deploy a new savings circle on Stellar"
        footerText="Stellar Save - Built for transparent, on-chain savings"
      >
        <CreateGroupContent />
      </AppLayout>
    </ToastProvider>
  );
}
