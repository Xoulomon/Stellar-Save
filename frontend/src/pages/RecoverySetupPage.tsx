/**
 * RecoverySetupPage — Social recovery for Stellar Save accounts.
 *
 * Two panels in a single page:
 *  1. Guardian Setup  — add/remove guardians, set threshold, persist to contract.
 *  2. Guardian Approvals — incoming recovery requests waiting for the connected
 *     wallet's approval.
 *
 * The page is a composition layer only: the panels live in
 * `components/recovery/`, their validation in `schemas/recoverySchema.ts`, and
 * their data access in `hooks/useRecoveryQueries.ts`.
 */
import { Alert, Divider, Stack } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';

import { GuardianApprovalsPanel, GuardianSetupPanel } from '../components/recovery';
import { useWallet } from '../hooks/useWallet';
import { AppLayout } from '../ui';

const LAYOUT_PROPS = {
  title: 'Social Recovery',
  subtitle: 'Configure guardians and approve recovery requests',
  footerText: 'Stellar Save',
};

export default function RecoverySetupPage() {
  const { activeAddress, status } = useWallet();

  if (status !== 'connected' || !activeAddress) {
    return (
      <AppLayout {...LAYOUT_PROPS}>
        <Alert severity="info">Connect your wallet to manage social recovery settings.</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout {...LAYOUT_PROPS}>
      <Stack spacing={3}>
        <Alert severity="info" icon={<ShieldIcon />}>
          Social recovery lets trusted guardians restore access to your account if you lose your
          private key. Guardians never control your funds — they only co-sign recovery.
        </Alert>

        <GuardianSetupPanel ownerAddress={activeAddress} />

        <Divider />

        <GuardianApprovalsPanel guardianAddress={activeAddress} />
      </Stack>
    </AppLayout>
  );
}
