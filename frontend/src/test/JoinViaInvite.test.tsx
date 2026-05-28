import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JoinViaInvite from '../pages/JoinViaInvite';
import { WalletContext } from '../wallet/WalletProvider';
import type { WalletContextValue } from '../wallet/types';

// Suppress navigate-after-unmount warnings in tests
vi.mock('../routing/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../routing/constants')>();
  return { ...actual, buildRoute: { ...actual.buildRoute, groupDetail: (id: string) => `/groups/${id}` } };
});

const connectedWallet: WalletContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'connected',
  activeAddress: 'GTEST1234567890ABCDEF',
  network: 'testnet',
  connectedAccounts: ['GTEST1234567890ABCDEF'],
  error: null,
  refreshWallets: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchWallet: vi.fn(),
  switchAccount: vi.fn(),
};

function renderPage(search: string, walletOverrides: Partial<WalletContextValue> = {}) {
  return render(
    <WalletContext.Provider value={{ ...connectedWallet, ...walletOverrides }}>
      <MemoryRouter initialEntries={[`/join${search}`]}>
        <Routes>
          <Route path="/join" element={<JoinViaInvite />} />
          <Route path="/groups/:groupId" element={<div>Group Detail</div>} />
        </Routes>
      </MemoryRouter>
    </WalletContext.Provider>
  );
}

describe('JoinViaInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when no groupId query param is present', () => {
    renderPage('');
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid invite link/i);
  });

  it('renders the group ID and Join Group button when groupId is provided', () => {
    renderPage('?groupId=group-42');
    expect(screen.getByText(/group-42/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join group/i })).toBeInTheDocument();
  });

  it('shows wallet hint when wallet is not connected', () => {
    renderPage('?groupId=group-42', { status: 'idle', activeAddress: null });
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  it('shows error when join is attempted without a connected wallet', async () => {
    renderPage('?groupId=group-42', { status: 'idle', activeAddress: null });
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/connect your wallet/i)
    );
  });

  it('shows success message and redirects after joining', async () => {
    renderPage('?groupId=group-42');
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/joined successfully/i),
      { timeout: 3000 }
    );

    await waitFor(() =>
      expect(screen.getByText('Group Detail')).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
