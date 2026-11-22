import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { WalletButton } from '../components/WalletButton';

import { withWallet, idleWallet, connectedWallet, expectNoA11yViolations } from './a11yHelpers';

describe('WalletButton – accessibility', () => {
  it('has no axe violations when disconnected', async () => {
    const { container } = withWallet(idleWallet, <WalletButton />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations when connected', async () => {
    const { container } = withWallet(connectedWallet, <WalletButton />);
    await expectNoA11yViolations(container);
  });

  it('"Connect Wallet" button is keyboard focusable', () => {
    withWallet(idleWallet, <WalletButton />);
    const btn = screen.getByRole('button', { name: /connect wallet/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('connected state button has accessible text (not just visual truncation)', () => {
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    expect(btn.textContent?.trim().length).toBeGreaterThan(0);
  });

  it('disconnect button in menu has accessible label', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });
});

describe('WalletButton – keyboard navigation', () => {
  it('Enter key opens the wallet menu when connected', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('Space key opens the wallet menu when connected', async () => {
    const user = userEvent.setup();
    withWallet(connectedWallet, <WalletButton />);
    const btn = screen.getByRole('button');
    btn.focus();
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });
});
