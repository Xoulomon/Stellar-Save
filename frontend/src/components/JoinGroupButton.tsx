import { useState } from 'react';
import { Button } from './Button';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useTransaction, explorerUrl } from '../hooks/useTransaction';

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
  const { joinGroup } = useContract();
  const { state, txHash, error, execute, reset } = useTransaction();
  const [showConfirm, setShowConfirm] = useState(false);

  const isFull = currentMembers >= maxMembers;
  const isPending = state === 'pending';

  if (isMember) return <Button disabled size="sm">Already Joined</Button>;
  if (isFull) return <Button disabled size="sm">Group Full</Button>;
  if (isActive) return <Button disabled size="sm">Group Active</Button>;
  if (walletStatus !== 'connected') return <Button disabled size="sm">Connect Wallet</Button>;

  const handleJoin = async () => {
    setShowConfirm(false);
    await execute(async () => {
      const result = await joinGroup({ groupId: BigInt(groupId) });
      if (result.error) throw new Error(result.error.message);
      return result.txHash!;
    });
    if (state !== 'failed') onSuccess?.();
  };

  if (state === 'confirmed') {
    return (
      <div>
        <Button disabled size="sm" variant="ghost">Joined ✓</Button>
        {txHash && (
          <a
            href={explorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, display: 'block', marginTop: 4 }}
          >
            View TX →
          </a>
        )}
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button size="sm" onClick={handleJoin} loading={isPending} disabled={isPending || !activeAddress}>
          Confirm
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowConfirm(false)} disabled={isPending}>
          Cancel
        </Button>
        {state === 'failed' && error && (
          <span style={{ color: 'var(--color-error)', fontSize: 12 }}>
            {error}{' '}
            <button onClick={reset} style={{ fontSize: 11 }}>Dismiss</button>
          </span>
        )}
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setShowConfirm(true)} disabled={isPending}>
      Join Group
    </Button>
  );
}
