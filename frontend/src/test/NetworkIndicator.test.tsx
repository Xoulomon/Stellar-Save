import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { NetworkIndicator } from '../components/NetworkIndicator';
import * as useWalletHook from '../hooks/useWallet';

vi.mock('../hooks/useWallet');

describe('NetworkIndicator', () => {
  it('displays current network', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      network: 'testnet',
    } as never);

    render(<NetworkIndicator />);
    expect(screen.getByText('testnet')).toBeInTheDocument();
  });

  it('defaults to testnet when no network', () => {
    vi.spyOn(useWalletHook, 'useWallet').mockReturnValue({
      network: null,
    } as never);

    render(<NetworkIndicator />);
    expect(screen.getByText('testnet')).toBeInTheDocument();
  });
});
