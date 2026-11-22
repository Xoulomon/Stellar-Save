import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { JoinGroupButton } from '../components/JoinGroupButton';
import { WalletContext } from '../wallet/WalletProvider';

import { idleWallet, connectedWallet, expectNoA11yViolations } from './a11yHelpers';

describe('JoinGroupButton – accessibility', () => {
  const defaultProps = {
    groupId: 1,
    maxMembers: 10,
    currentMembers: 5,
    isActive: false,
  };

  it('has no axe violations (eligible state)', async () => {
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (confirmation state)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: /join group/i }));
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (disabled states)', async () => {
    const { container } = render(
      <WalletContext.Provider value={idleWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await expectNoA11yViolations(container);
  });

  it('all buttons are keyboard focusable', async () => {
    const user = userEvent.setup();
    render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: /join group/i }));
    const confirm = screen.getByRole('button', { name: /confirm/i });
    confirm.focus();
    expect(document.activeElement).toBe(confirm);
  });
});
