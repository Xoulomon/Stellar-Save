import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetworkIndicator } from '../components/NetworkIndicator';
import * as useWalletHook from '../hooks/useWallet';
import type { WalletContextValue } from '../wallet/types';

vi.mock('../hooks/useWallet');

describe('NetworkIndicator', () => {
  it('displays current network', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      network: 'testnet',
    } as WalletContextValue);

    render(<NetworkIndicator />);
    expect(screen.getByText('testnet')).toBeInTheDocument();
  });

  it('defaults to testnet when no network', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      network: null,
    } as WalletContextValue);

    render(<NetworkIndicator />);
    expect(screen.getByText('testnet')).toBeInTheDocument();
  });
});
