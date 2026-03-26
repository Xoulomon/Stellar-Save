import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { JoinGroupButton } from '../components/JoinGroupButton';
import { WalletContext } from '../wallet/WalletProvider';

const mockWalletContext = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'connected' as const,
  activeAddress: 'GTEST123',
  network: 'testnet',
  connectedAccounts: ['GTEST123'],
  error: null,
  refreshWallets: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchWallet: vi.fn(),
  switchAccount: vi.fn(),
};

describe('JoinGroupButton', () => {
  it('shows "Already Joined" when user is member', () => {
    render(
      <WalletContext.Provider value={mockWalletContext}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={5}
          isActive={false}
          isMember={true}
        />
      </WalletContext.Provider>
    );
    expect(screen.getByText('Already Joined')).toBeInTheDocument();
  });

  it('shows "Group Full" when max members reached', () => {
    render(
      <WalletContext.Provider value={mockWalletContext}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={10}
          isActive={false}
        />
      </WalletContext.Provider>
    );
    expect(screen.getByText('Group Full')).toBeInTheDocument();
  });

  it('shows "Group Active" when group is active', () => {
    render(
      <WalletContext.Provider value={mockWalletContext}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={5}
          isActive={true}
        />
      </WalletContext.Provider>
    );
    expect(screen.getByText('Group Active')).toBeInTheDocument();
  });

  it('shows "Connect Wallet" when wallet not connected', () => {
    render(
      <WalletContext.Provider value={{ ...mockWalletContext, status: 'idle' }}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={5}
          isActive={false}
        />
      </WalletContext.Provider>
    );
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows confirmation dialog when clicked', async () => {
    const user = userEvent.setup();
    render(
      <WalletContext.Provider value={mockWalletContext}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={5}
          isActive={false}
        />
      </WalletContext.Provider>
    );
    
    await user.click(screen.getByText('Join Group'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onSuccess after successful join', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    
    render(
      <WalletContext.Provider value={mockWalletContext}>
        <JoinGroupButton
          groupId={1}
          maxMembers={10}
          currentMembers={5}
          isActive={false}
          onSuccess={onSuccess}
        />
      </WalletContext.Provider>
    );
    
    await user.click(screen.getByText('Join Group'));
    await user.click(screen.getByText('Confirm'));
    
    // Wait for async operation
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
