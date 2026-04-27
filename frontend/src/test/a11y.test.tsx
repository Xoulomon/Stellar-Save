/**
 * Accessibility tests for key UI components.
 *
 * Uses vitest-axe (axe-core) to assert zero WCAG violations.
 * Also covers keyboard navigation and screen reader support.
 */
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { WalletContext } from '../wallet/WalletProvider';
import type { WalletContextValue } from '../wallet/types';
import { WalletButton } from '../components/WalletButton';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { JoinGroupButton } from '../components/JoinGroupButton';
import { ContributeButton } from '../components/ContributeButton';
import { Input } from '../components/Input';

expect.extend(toHaveNoViolations);

// ── Shared wallet context fixtures ────────────────────────────────────────────

const idleWallet: WalletContextValue = {
  wallets: [], selectedWalletId: 'freighter', status: 'idle',
  activeAddress: null, network: null, connectedAccounts: [], error: null,
  refreshWallets: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
  switchWallet: vi.fn(), switchAccount: vi.fn(),
};

const connectedWallet: WalletContextValue = {
  ...idleWallet,
  status: 'connected',
  activeAddress: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU',
};

function withWallet(wallet: WalletContextValue, ui: React.ReactElement) {
  return render(
    <WalletContext.Provider value={wallet}>
      <MemoryRouter>{ui}</MemoryRouter>
    </WalletContext.Provider>
  );
}

// ── 1. Input component ────────────────────────────────────────────────────────

describe('Input – accessibility', () => {
  it('has no axe violations (basic)', async () => {
    const { container } = render(
      <Input label="Group Name" value="" onChange={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (with error)', async () => {
    const { container } = render(
      <Input label="Group Name" value="" onChange={vi.fn()} error="Name is required" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('label is associated with input via htmlFor/id', () => {
    render(<Input label="Contribution Amount" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText(/contribution amount/i);
    expect(input).toBeInTheDocument();
  });

  it('error message has role="alert" for screen reader announcement', () => {
    render(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('aria-invalid is true when error is present', () => {
    render(<Input label="Amount" value="" onChange={vi.fn()} error="Required" />);
    expect(screen.getByLabelText(/amount/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('aria-describedby points to error element', () => {
    render(<Input label="Amount" id="amt" value="" onChange={vi.fn()} error="Required" />);
    const input = screen.getByLabelText(/amount/i);
    expect(input).toHaveAttribute('aria-describedby', 'amt-error');
    expect(document.getElementById('amt-error')).toHaveTextContent('Required');
  });
});

// ── 2. WalletButton ───────────────────────────────────────────────────────────

describe('WalletButton – accessibility', () => {
  it('has no axe violations when disconnected', async () => {
    const { container } = withWallet(idleWallet, <WalletButton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when connected', async () => {
    const { container } = withWallet(connectedWallet, <WalletButton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('"Connect Wallet" button is keyboard focusable', () => {
    withWallet(idleWallet, <WalletButton />);
    const btn = screen.getByRole('button', { name: /connect wallet/i });
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it('connected state button has accessible text (not just visual truncation)', () => {
    withWallet(connectedWallet, <WalletButton />);
    // The button must have some accessible text — address prefix is visible text
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

// ── 3. CreateGroupForm ────────────────────────────────────────────────────────

describe('CreateGroupForm – accessibility', () => {
  it('has no axe violations on step 1', async () => {
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 2', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 3', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations on step 4 (review)', async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/contribution amount/i), '10');
    await user.selectOptions(screen.getByRole('combobox'), '604800');
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.type(screen.getByLabelText(/maximum members/i), '5');
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('progress bar has correct ARIA attributes', () => {
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemin', '1');
    expect(progressbar).toHaveAttribute('aria-valuemax', '4');
  });

  it('all step-1 fields are reachable via Tab', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/group name/i));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText(/description/i));
  });

  it('form can be advanced via keyboard (Enter on Next button)', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    screen.getByRole('button', { name: /next/i }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(/financial settings/i)).toBeInTheDocument();
  });

  it('validation errors are announced via role="alert"', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    const alerts = screen.getAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('cycle duration select has an accessible label', async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/group name/i), 'My Group');
    await user.type(screen.getByLabelText(/description/i), 'A description');
    await user.click(screen.getByRole('button', { name: /next/i }));
    // The select must be labelled
    expect(screen.getByLabelText(/cycle duration/i)).toBeInTheDocument();
  });
});

// ── 4. JoinGroupButton ────────────────────────────────────────────────────────

describe('JoinGroupButton – accessibility', () => {
  const defaultProps = {
    groupId: 1, maxMembers: 10, currentMembers: 5, isActive: false,
  };

  it('has no axe violations (eligible state)', async () => {
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (confirmation state)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <WalletContext.Provider value={connectedWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    await user.click(screen.getByRole('button', { name: /join group/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (disabled states)', async () => {
    const { container } = render(
      <WalletContext.Provider value={idleWallet}>
        <JoinGroupButton {...defaultProps} />
      </WalletContext.Provider>
    );
    expect(await axe(container)).toHaveNoViolations();
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

// ── 5. ContributeButton ───────────────────────────────────────────────────────

describe('ContributeButton – accessibility', () => {
  it('has no axe violations (idle state)', async () => {
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} walletAddress="GABC" />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (no wallet — warning shown)', async () => {
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations (confirmation modal open)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ContributeButton amount={10} cycleId={1} walletAddress="GABC" />
    );
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('confirmation modal heading is present', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('heading', { name: /confirm contribution/i })).toBeInTheDocument();
  });

  it('confirmation modal buttons are keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={10} cycleId={1} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);
  });
});
