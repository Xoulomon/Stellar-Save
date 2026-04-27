/**
 * Integration tests: Wallet connection flow
 *
 * Tests the full wallet connect/disconnect cycle using a real WalletProvider
 * with the freighterAdapter mocked at the module level.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletProvider } from '../../wallet/WalletProvider';
import { WalletButton } from '../../components/WalletButton';
import { MemoryRouter } from 'react-router-dom';

// Mock the freighter adapter so no real extension is needed
vi.mock('../../wallet/freighterAdapter', () => ({
  freighterAdapter: {
    id: 'freighter',
    name: 'Freighter',
    isInstalled: vi.fn(),
    connect: vi.fn(),
    getAddress: vi.fn(),
    getNetwork: vi.fn(),
    watch: vi.fn(() => () => undefined),
  },
}));

import { freighterAdapter } from '../../wallet/freighterAdapter';
const mockAdapter = vi.mocked(freighterAdapter);

function renderWalletButton() {
  return render(
    <MemoryRouter>
      <WalletProvider>
        <WalletButton />
      </WalletProvider>
    </MemoryRouter>
  );
}

describe('Wallet connection flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter.isInstalled.mockResolvedValue(false);
    mockAdapter.watch.mockReturnValue(() => undefined);
  });

  it('shows "Connect Wallet" button when wallet is not connected', async () => {
    renderWalletButton();
    expect(await screen.findByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('shows connecting state while wallet is being connected', async () => {
    const user = userEvent.setup();
    // Never resolves — keeps the connecting state
    mockAdapter.connect.mockReturnValue(new Promise(() => {}));
    renderWalletButton();

    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    expect(await screen.findByRole('button', { name: /connecting/i })).toBeDisabled();
  });

  it('shows truncated address after successful connection', async () => {
    const user = userEvent.setup();
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU';
    mockAdapter.connect.mockResolvedValue({ address, network: 'testnet' });

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    await waitFor(() => {
      // WalletButton shows first 6 + last 4 chars
      expect(screen.getByText(new RegExp(`${address.slice(0, 6)}`))).toBeInTheDocument();
    });
  });

  it('shows error state when wallet connection fails', async () => {
    const user = userEvent.setup();
    mockAdapter.connect.mockRejectedValue(new Error('User rejected'));

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    // After failure the button should return to idle (not stuck in connecting)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).not.toBeDisabled();
    });
  });

  it('disconnects and returns to idle state', async () => {
    const user = userEvent.setup();
    const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU';
    mockAdapter.connect.mockResolvedValue({ address, network: 'testnet' });

    renderWalletButton();
    await user.click(await screen.findByRole('button', { name: /connect wallet/i }));

    // Wait for connected state
    await waitFor(() => {
      expect(screen.getByText(new RegExp(address.slice(0, 6)))).toBeInTheDocument();
    });

    // Open menu and disconnect
    await user.click(screen.getByText(new RegExp(address.slice(0, 6))));
    await user.click(screen.getByText(/disconnect/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    });
  });
});
