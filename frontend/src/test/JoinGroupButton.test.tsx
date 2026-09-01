import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { JoinGroupButton } from '../components/JoinGroupButton';
import * as useWalletModule from '../hooks/useWallet';
import { queryKeys } from '../lib/queryKeys';

import type { WalletContextValue } from '../wallet/types';

// Prevent Vite from transforming WalletProvider (which imports the broken @creit.tech package)
vi.mock('../wallet/WalletProvider', () => ({ WalletContext: { Provider: ({ children }: { children: React.ReactNode }) => children } }));

const baseWallet: WalletContextValue = {
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
  signTransaction: vi.fn(),
  signMessage: vi.fn(),
};

vi.mock('../hooks/useWallet');
vi.mock('../hooks/useContract', () => ({
  useContract: () => ({ joinGroup: vi.fn().mockResolvedValue({ txHash: 'abc123', error: null }) }),
}));

function renderWithClient(
  ui: React.ReactElement,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) {
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

describe('JoinGroupButton', () => {
  beforeEach(() => {
    vi.mocked(useWalletModule.useWallet).mockReturnValue(baseWallet);
  });

  it('shows "Already Joined" when user is member', () => {
    renderWithClient(
      <JoinGroupButton
        groupId={1}
        maxMembers={10}
        currentMembers={5}
        isActive={false}
        isMember={true}
      />
    );
    expect(screen.getByText('Already Joined')).toBeInTheDocument();
  });

  it('shows "Group Full" when max members reached', () => {
    renderWithClient(
      <JoinGroupButton groupId={1} maxMembers={10} currentMembers={10} isActive={false} />
    );
    expect(screen.getByText('Group Full')).toBeInTheDocument();
  });

  it('shows "Group Active" when group is active', () => {
    renderWithClient(
      <JoinGroupButton groupId={1} maxMembers={10} currentMembers={5} isActive={true} />
    );
    expect(screen.getByText('Group Active')).toBeInTheDocument();
  });

  it('shows "Connect Wallet" when wallet not connected', () => {
    vi.mocked(useWalletModule.useWallet).mockReturnValue({ ...baseWallet, status: 'idle' });
    renderWithClient(<JoinGroupButton groupId={1} maxMembers={10} currentMembers={5} isActive={false} />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows confirmation dialog when clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <JoinGroupButton groupId={1} maxMembers={10} currentMembers={5} isActive={false} />
    );
    await user.click(screen.getByText('Join Group'));
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onSuccess after successful join', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderWithClient(
      <JoinGroupButton
        groupId={1}
        maxMembers={10}
        currentMembers={5}
        isActive={false}
        onSuccess={onSuccess}
      />
    );
    await user.click(screen.getByText('Join Group'));
    await user.click(screen.getByText('Confirm'));
    await waitFor(
      () => {
        expect(onSuccess).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );
  });

  it('invalidates the shared groups query cache after a successful join', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(
      <JoinGroupButton groupId={42} maxMembers={10} currentMembers={5} isActive={false} />,
      queryClient
    );
    await user.click(screen.getByText('Join Group'));
    await user.click(screen.getByText('Confirm'));

    await waitFor(
      () => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.groups.all() });
      },
      { timeout: 3000 }
    );
  });
});
