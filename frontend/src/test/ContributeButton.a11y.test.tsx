import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { ContributeButton } from '../components/ContributeButton';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('ContributeButton – accessibility', () => {
  it('has no axe violations (idle state)', async () => {
    const { container } = renderWithA11y(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (no wallet — warning shown)', async () => {
    const { container } = renderWithA11y(<ContributeButton amount={10} cycleId={1} />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (confirmation modal open)', async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await expectNoA11yViolations(container);
  });

  it('confirmation modal heading is present', async () => {
    const user = userEvent.setup();
    renderWithA11y(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('heading', { name: /confirm contribution/i })).toBeInTheDocument();
  });

  it('confirmation modal buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    renderWithA11y(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('modal can be dismissed with Escape key', async () => {
    const user = userEvent.setup();
    renderWithA11y(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('heading', { name: /confirm contribution/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('heading', { name: /confirm contribution/i })
    ).not.toBeInTheDocument();
  });
});
