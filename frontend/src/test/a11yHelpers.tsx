/**
 * Shared setup for the per-component accessibility suites (split out of the
 * former monolithic a11y.test.tsx — see #1915).
 *
 * `toHaveNoViolations` is already registered globally in setup.ts, so suites
 * only need the render + axe helpers below.
 */
import { render, type RenderResult } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { WalletContext } from '../wallet/WalletProvider';

import type { WalletContextValue } from '../wallet/types';

export const idleWallet: WalletContextValue = {
  wallets: [],
  selectedWalletId: 'freighter',
  status: 'idle',
  activeAddress: null,
  network: null,
  connectedAccounts: [],
  error: null,
  refreshWallets: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  switchWallet: vi.fn(),
  switchAccount: vi.fn(),
  signTransaction: vi.fn(),
};

export const connectedWallet: WalletContextValue = {
  ...idleWallet,
  status: 'connected',
  activeAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU',
};

export function withWallet(wallet: WalletContextValue, ui: React.ReactElement): RenderResult {
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter>{ui}</MemoryRouter>
    </WalletContext.Provider>
  );
}

export function withRouter(ui: React.ReactElement): RenderResult {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** Renders a component under test. Named distinctly from `render` so a11y suites read as self-contained. */
export function renderWithA11y(ui: React.ReactElement): RenderResult {
  return render(ui);
}

/** Runs axe against a rendered container and asserts zero WCAG 2.1 AA violations. */
export async function expectNoA11yViolations(container: Element): Promise<void> {
  expect(await axe(container)).toHaveNoViolations();
}
