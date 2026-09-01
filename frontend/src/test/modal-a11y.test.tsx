/**
 * Accessibility tests for modal/dialog components (issue #1264).
 *
 * Covers the modal dialogs across the app: MUI-based dialogs (which get
 * focus-trap, aria-modal and Escape-to-close for free from @mui/material),
 * and the ConfirmModal used by the "contribute" flow (a hand-rolled dialog
 * wired up with the shared `useFocusTrap` hook).
 *
 * Uses jest-axe (axe-core) to assert zero WCAG 2.1 AA violations, plus
 * Testing Library interactions to verify keyboard-only focus-trap
 * (Tab/Shift+Tab cycling) and Escape-to-close behavior — axe alone cannot
 * catch focus-trap regressions.
 *
 * Note: ContributionSuccessModal and OnboardingTutorial (also custom,
 * non-MUI dialogs) have their own dedicated a11y coverage in
 * ContributionSuccessModal.test.tsx and OnboardingTutorial.test.tsx.
 *
 * `useWallet`/`useContract` are mocked here so these tests are isolated
 * from the wallet integration layer, which is unrelated to modal a11y.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ContributeButton } from '../components/ContributeButton';
import { GroupSettings } from '../components/GroupSettings';
import { JoinGroupModal } from '../components/JoinGroupModal';
import { TemplatePreviewModal } from '../components/templates/TemplatePreviewModal';
import { SaveTemplateModal } from '../components/TransactionBuilder/SaveTemplateModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { WalletSelectModal } from '../components/WalletSelectModal';
import { useContract } from '../hooks/useContract';
import { useWallet } from '../hooks/useWallet';

import type { PublicGroup, GroupDetail } from '../types/group';
import type { GroupTemplate } from '../types/template';
import type { Transaction } from '../types/transaction';

expect.extend(toHaveNoViolations);

// `useWallet`/`useContract` pull in the wallet SDK integration layer, which is
// unrelated to modal accessibility — mock them at the hook boundary so these
// tests exercise only the dialog markup/behavior.
vi.mock('../hooks/useWallet', () => ({ useWallet: vi.fn() }));
vi.mock('../hooks/useContract', () => ({ useContract: vi.fn() }));

// ── Shared fixtures ───────────────────────────────────────────────────────────

const group: PublicGroup = {
  id: 'group-1',
  name: 'Family Circle',
  description: 'A rotating savings group for the family.',
  memberCount: 5,
  contributionAmount: 25,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2026-01-01'),
};

const template: GroupTemplate = {
  id: 1,
  name: 'Weekly Saver',
  description: 'Frequent payouts for tight-knit groups with short commitment windows.',
  cycleDuration: 7,
  maxMembers: 10,
  totalDuration: '~10 weeks',
  category: 'short',
};

const transaction: Transaction = {
  id: 'tx-1',
  hash: 'abcdef1234567890',
  createdAt: new Date('2026-01-01').toISOString(),
  type: 'payment',
  amount: '25',
  assetCode: 'XLM',
  from: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTU',
  status: 'success',
  fee: '0.00001',
};

const groupDetail: GroupDetail = {
  ...group,
  creator: 'GCREATOR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789',
  cycleDuration: 604800,
  maxMembers: 10,
  minMembers: 3,
  currentCycle: 1,
  isActive: true,
  started: true,
  startedAt: new Date('2026-01-02'),
};

// ── 1. JoinGroupModal ──────────────────────────────────────────────────────────

describe('JoinGroupModal – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <JoinGroupModal group={group} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has aria-describedby pointing to the commitment description', () => {
    render(<JoinGroupModal group={group} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'join-group-description');
    expect(document.getElementById('join-group-description')).toHaveTextContent(/By joining/i);
  });

  it('has an accessible name from the visible title (aria-labelledby wired by MUI)', () => {
    render(<JoinGroupModal group={group} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /join group/i })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<JoinGroupModal group={group} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel button is keyboard reachable', () => {
    render(<JoinGroupModal group={group} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const cancel = screen.getByRole('button', { name: /cancel/i });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
  });
});

// ── 2. TemplatePreviewModal ────────────────────────────────────────────────────

describe('TemplatePreviewModal – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <TemplatePreviewModal template={template} onClose={vi.fn()} onUse={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has aria-describedby pointing to the template description', () => {
    render(<TemplatePreviewModal template={template} onClose={vi.fn()} onUse={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-describedby', 'template-preview-description');
    expect(document.getElementById('template-preview-description')).toHaveTextContent(
      template.description
    );
  });

  it('has an accessible name from the visible title', () => {
    render(<TemplatePreviewModal template={template} onClose={vi.fn()} onUse={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: template.name })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<TemplatePreviewModal template={template} onClose={onClose} onUse={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// ── 3. SaveTemplateModal ───────────────────────────────────────────────────────

describe('SaveTemplateModal – accessibility', () => {
  const steps = [
    { id: '1', type: 'payment' as const, label: 'Send payment', params: {}, enabled: true },
  ];

  it('has no axe violations', async () => {
    const { container } = render(<SaveTemplateModal open onClose={vi.fn()} steps={steps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has an accessible name from the visible title', () => {
    render(<SaveTemplateModal open onClose={vi.fn()} steps={steps} />);
    expect(screen.getByRole('dialog', { name: /save transaction template/i })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SaveTemplateModal open onClose={onClose} steps={steps} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel button is keyboard reachable', () => {
    render(<SaveTemplateModal open onClose={vi.fn()} steps={steps} />);
    const cancel = screen.getByRole('button', { name: /cancel/i });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
  });
});

// ── 4. TransactionDetailModal ──────────────────────────────────────────────────

describe('TransactionDetailModal – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <TransactionDetailModal transaction={transaction} isOpen onClose={vi.fn()} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has an accessible name from the visible title', () => {
    render(<TransactionDetailModal transaction={transaction} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /transaction details/i })).toBeInTheDocument();
  });

  it('has a visible, keyboard-reachable close control', () => {
    render(<TransactionDetailModal transaction={transaction} isOpen onClose={vi.fn()} />);
    const closeIcon = screen.getByRole('button', { name: /close dialog/i });
    closeIcon.focus();
    expect(document.activeElement).toBe(closeIcon);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<TransactionDetailModal transaction={transaction} isOpen onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// ── 5. WalletSelectModal (useWallet mocked) ────────────────────────────────────

describe('WalletSelectModal – accessibility', () => {
  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue({
      wallets: [
        { id: 'freighter', name: 'Freighter', installed: true },
        { id: 'albedo', name: 'Albedo', installed: false },
      ],
      switchWallet: vi.fn(),
    } as unknown as ReturnType<typeof useWallet>);
  });

  it('has no axe violations', async () => {
    const { container } = render(<WalletSelectModal open onClose={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has a visible, keyboard-reachable close control', () => {
    render(<WalletSelectModal open onClose={vi.fn()} />);
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<WalletSelectModal open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<WalletSelectModal open onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// ── 6. ContributeButton's ConfirmModal (useContract mocked) ────────────────────

describe('ContributeButton confirmation dialog – accessibility', () => {
  beforeEach(() => {
    vi.mocked(useContract).mockReturnValue({
      contribute: vi.fn().mockResolvedValue({ txHash: 'tx_mock', error: null }),
    } as unknown as ReturnType<typeof useContract>);
  });

  it('has no axe violations when open', async () => {
    const user = userEvent.setup();
    const { container } = render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('dialog has role, aria-modal, aria-labelledby and aria-describedby', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-contribution-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-contribution-description');
    expect(screen.getByRole('dialog', { name: /confirm contribution/i })).toBeInTheDocument();
  });

  it('moves focus into the dialog when opened', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('Tab cycles focus within the dialog and wraps around', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));

    const cancel = screen.getByRole('button', { name: /cancel/i });
    const confirm = screen.getByRole('button', { name: /^confirm$/i });

    expect(document.activeElement).toBe(cancel);

    confirm.focus();
    await user.tab();
    expect(document.activeElement).toBe(cancel);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('closes on Escape and restores focus to the Contribute button', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    const trigger = screen.getByRole('button', { name: /contribute/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when clicking the backdrop', async () => {
    const user = userEvent.setup();
    render(<ContributeButton amount={25} cycleId={2} walletAddress="GABC" />);
    await user.click(screen.getByRole('button', { name: /contribute/i }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── 7. GroupSettings confirm dialog (useWallet mocked) ─────────────────────────

describe('GroupSettings confirm dialog – accessibility', () => {
  beforeEach(() => {
    vi.mocked(useWallet).mockReturnValue({
      activeAddress: groupDetail.creator,
    } as unknown as ReturnType<typeof useWallet>);
  });

  async function openConfirmDialog() {
    const user = userEvent.setup();
    const utils = render(<GroupSettings group={groupDetail} />);
    await user.clear(screen.getByLabelText(/group name/i));
    await user.type(screen.getByLabelText(/group name/i), 'New Name');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    return utils;
  }

  it('has no axe violations when the confirm dialog is open', async () => {
    const { container } = await openConfirmDialog();
    expect(screen.getByRole('dialog', { name: /confirm changes/i })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('confirm dialog closes on Escape', async () => {
    await openConfirmDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Cancel button is keyboard reachable', async () => {
    await openConfirmDialog();
    const cancel = screen.getByRole('button', { name: /cancel/i });
    cancel.focus();
    expect(document.activeElement).toBe(cancel);
  });
});
