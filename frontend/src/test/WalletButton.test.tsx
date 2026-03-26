import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WalletButton } from '../components/WalletButton';
import * as useWalletHook from '../hooks/useWallet';

vi.mock('../hooks/useWallet');

describe('WalletButton', () => {
  it('shows connect button when disconnected', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'idle',
      activeAddress: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any);

    render(<WalletButton />);
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows address when connected', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      status: 'connected',
      activeAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      connect: vi.fn(),
      disconnect: vi.fn(),
    } as any);

    render(<WalletButton />);
    expect(screen.getByText(/GABCDE...7890/)).toBeInTheDocument();
  });
});
