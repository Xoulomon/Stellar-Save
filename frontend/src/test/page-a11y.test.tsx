import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import { BrowseGroupsPage } from '../pages/BrowseGroupsPage';
import { ProfilePage } from '../pages/ProfilePage';
import { WalletContext } from '../wallet/WalletProvider';

expect.extend(toHaveNoViolations);

const mockWallet = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'connected' as const,
  activeAddress: 'GABC1234567890',
  network: 'testnet',
  connectedAccounts: [],
  error: null,
  refreshWallets: () => {},
  connect: async () => {},
  disconnect: async () => {},
  switchWallet: async () => {},
  switchAccount: async () => {},
};

function withProviders(ui: React.ReactElement) {
  return render(
    <WalletContext.Provider value={mockWallet}>
      <MemoryRouter>{ui}</MemoryRouter>
    </WalletContext.Provider>
  );
}

describe('Page-level Accessibility Audit', () => {
  it('ProfilePage has no axe violations', async () => {
    const { container } = withProviders(<ProfilePage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('BrowseGroupsPage has no axe violations', async () => {
    const { container } = withProviders(<BrowseGroupsPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
