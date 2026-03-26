import { useState } from 'react';
import { Button } from './Button';
import { useWallet } from '../hooks/useWallet';

interface JoinGroupButtonProps {
  groupId: number;
  maxMembers: number;
  currentMembers: number;
  isActive: boolean;
  isMember?: boolean;
  onSuccess?: () => void;
}

export function JoinGroupButton({
  groupId,
  maxMembers,
  currentMembers,
  isActive,
  isMember = false,
  onSuccess,
}: JoinGroupButtonProps) {
  const { activeAddress, status: walletStatus } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFull = currentMembers >= maxMembers;
  const isEligible = !isMember && !isFull && !isActive && walletStatus === 'connected';

  const handleJoin = async () => {
    if (!activeAddress) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Implement contract interaction
      // const contract = new Contract(CONTRACT_ADDRESS);
      // await contract.join_group({ group_id: groupId, member: activeAddress });
      
      // Simulate transaction for now
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowConfirm(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  if (isMember) {
    return <Button disabled size="sm">Already Joined</Button>;
  }

  if (isFull) {
    return <Button disabled size="sm">Group Full</Button>;
  }

  if (isActive) {
    return <Button disabled size="sm">Group Active</Button>;
  }

  if (walletStatus !== 'connected') {
    return <Button disabled size="sm">Connect Wallet</Button>;
  }

  if (showConfirm) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button
          size="sm"
          onClick={handleJoin}
          loading={loading}
          disabled={loading}
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowConfirm(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        {error && <span style={{ color: 'var(--color-error)', fontSize: '12px' }}>{error}</span>}
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={() => setShowConfirm(true)}
      disabled={!isEligible}
    >
      Join Group
    </Button>
  );
}
