/**
 * Integration tests: Join group flow
 *
 * Tests the full join-group interaction: confirmation step, loading state,
 * success callback, and error/disabled states.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JoinGroupButton } from '../../components/JoinGroupButton';
import { WalletContext } from '../../wallet/WalletProvider';
import type { WalletContextValue } from '../../wallet/types';

const connectedWallet: WalletContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'connected',
  activeAddress: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  network: 'testnet',
  connectedAccounts: ['GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'],
  error: null,
  refreshWallets: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchWallet: vi.fn(),
  switchAccount: vi.fn(),
};

function renderJoinButton(
  overrides: Partial<WalletContextValue> = {},
  props: Partial<React.ComponentProps<typeof JoinGroupButton>> = {}
) {
  return render(
    <WalletContext.Provider value={{ ...connectedWallet, ...overrides }}>
      <JoinGroupButton
        groupId={1}
        maxMembers={10}
        currentMembers={5}
        isActive={false}
        {...props}
      />
    </WalletContext.Provider>
  );
}

describe('Join group flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Join Group" button when user is eligible', () => {
    renderJoinButton();
    expect(screen.getByRole('button', { name: /join group/i })).toBeInTheDocument();
  });

  it('shows confirmation step when "Join Group" is clicked', async () => {
    const user = userEvent.setup();
    renderJoinButton();

    await user.click(screen.getByRole('button', { name: /join group/i }));

    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('returns to initial state when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderJoinButton();

    await user.click(screen.getByRole('button', { name: /join group/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /join group/i })).toBeInTheDocument();
  });

  it('shows loading state while join is in progress', async () => {
    const user = userEvent.setup();
    renderJoinButton();

    await user.click(screen.getByRole('button', { name: /join group/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    // Confirm button should be disabled while loading
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
  });

  it('calls onSuccess after join completes', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderJoinButton({}, { onSuccess });

    await user.click(screen.getByRole('button', { name: /join group/i }));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), { timeout: 4000 });
  });

  // Error paths
  it('shows "Connect Wallet" when wallet is not connected', () => {
    renderJoinButton({ status: 'idle', activeAddress: null });
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeDisabled();
  });

  it('shows "Already Joined" when user is already a member', () => {
    renderJoinButton({}, { isMember: true });
    expect(screen.getByRole('button', { name: /already joined/i })).toBeDisabled();
  });

  it('shows "Group Full" when group has reached max members', () => {
    renderJoinButton({}, { currentMembers: 10, maxMembers: 10 });
    expect(screen.getByRole('button', { name: /group full/i })).toBeDisabled();
  });

  it('shows "Group Active" when group is already active', () => {
    renderJoinButton({}, { isActive: true });
    expect(screen.getByRole('button', { name: /group active/i })).toBeDisabled();
  });
});
