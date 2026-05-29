import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransactionConfirmModal } from '../components/TransactionConfirmModal';
import type { TransactionDetails } from '../components/TransactionConfirmModal';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CONTRIBUTION_TX: TransactionDetails = {
  type: 'contribute',
  title: 'Contribute to Savings Circle',
  amount: 250,
  estimatedFee: 0.00001,
  from: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
  to: 'GCONTRACT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD',
  groupName: 'Community Savings Circle',
  cycleId: 3,
};

const JOIN_TX: TransactionDetails = {
  type: 'join',
  title: 'Join Savings Group',
  estimatedFee: 0.00001,
  from: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
  groupName: 'Community Savings Circle',
};

function renderModal(
  overrides: Partial<{
    open: boolean;
    transaction: TransactionDetails;
    onConfirm: () => Promise<string>;
    onClose: () => void;
    onSuccess: (hash: string) => void;
    onError: (err: Error) => void;
  }> = {},
) {
  const defaults = {
    open: true,
    transaction: CONTRIBUTION_TX,
    onConfirm: vi.fn().mockResolvedValue('tx_abc123def456'),
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<TransactionConfirmModal {...props} />), props };
}

// ── Initial render (review step) ──────────────────────────────────────────────

describe('TransactionConfirmModal – review step', () => {
  it('renders the dialog when open', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows transaction title', () => {
    renderModal();
    expect(screen.getByText('Contribute to Savings Circle')).toBeInTheDocument();
  });

  it('shows group name', () => {
    renderModal();
    expect(screen.getByText('Community Savings Circle')).toBeInTheDocument();
  });

  it('shows cycle chip', () => {
    renderModal();
    expect(screen.getByText('Cycle #3')).toBeInTheDocument();
  });

  it('shows amount in cost breakdown', () => {
    renderModal();
    expect(screen.getByText('250 XLM')).toBeInTheDocument();
  });

  it('shows estimated fee', () => {
    renderModal();
    expect(screen.getByText(/0\.00001 XLM/)).toBeInTheDocument();
  });

  it('shows stepper with Review step active', () => {
    renderModal();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('shows "Review Transaction" button', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /review transaction/i })).toBeInTheDocument();
  });

  it('shows "Edit" button that calls onClose', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows advanced details toggle', () => {
    renderModal();
    expect(screen.getByText(/show transaction details/i)).toBeInTheDocument();
  });

  it('expands advanced details on toggle click', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText(/show transaction details/i));
    // Addresses should now be visible
    expect(screen.getByText(/hide transaction details/i)).toBeInTheDocument();
  });

  it('shows wallet info alert', () => {
    renderModal();
    expect(screen.getByText(/freighter wallet/i)).toBeInTheDocument();
  });
});

// ── Confirm step ──────────────────────────────────────────────────────────────

describe('TransactionConfirmModal – confirm step', () => {
  async function goToConfirm() {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    return user;
  }

  it('advances to confirm step on "Review Transaction" click', async () => {
    await goToConfirm();
    expect(screen.getByRole('button', { name: /confirm & sign/i })).toBeInTheDocument();
  });

  it('shows irreversible warning on confirm step', async () => {
    await goToConfirm();
    expect(screen.getByText(/cannot be reversed/i)).toBeInTheDocument();
  });

  it('shows all transaction details on confirm step', async () => {
    await goToConfirm();
    expect(screen.getByText('Contribute to Savings Circle')).toBeInTheDocument();
    expect(screen.getByText('Community Savings Circle')).toBeInTheDocument();
  });

  it('shows back button that returns to review step', async () => {
    const user = await goToConfirm();
    await user.click(screen.getByRole('button', { name: /← back/i }));
    expect(screen.getByRole('button', { name: /review transaction/i })).toBeInTheDocument();
  });
});

// ── Submitting step ───────────────────────────────────────────────────────────

describe('TransactionConfirmModal – submitting step', () => {
  it('shows spinner while submitting', async () => {
    const user = userEvent.setup();
    // onConfirm never resolves during this test
    const onConfirm = vi.fn(() => new Promise<string>(() => {}));
    renderModal({ onConfirm });

    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));

    expect(screen.getByText(/submitting transaction/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('close button is hidden while submitting', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => new Promise<string>(() => {}));
    renderModal({ onConfirm });

    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));

    expect(screen.queryByRole('button', { name: /close dialog/i })).not.toBeInTheDocument();
  });
});

// ── Success step ──────────────────────────────────────────────────────────────

describe('TransactionConfirmModal – success step', () => {
  async function goToSuccess(onSuccess = vi.fn()) {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue('tx_abc123def456');
    renderModal({ onConfirm, onSuccess });

    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction confirmed/i)).toBeInTheDocument();
    });

    return { user, onSuccess };
  }

  it('shows success message', async () => {
    await goToSuccess();
    expect(screen.getByText(/transaction confirmed/i)).toBeInTheDocument();
  });

  it('shows tx hash', async () => {
    await goToSuccess();
    // Hash is formatted/truncated
    expect(screen.getByText(/tx_abc123/i)).toBeInTheDocument();
  });

  it('shows Stellar Explorer link', async () => {
    await goToSuccess();
    const link = screen.getByRole('link', { name: /view on stellar explorer/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('tx_abc123def456'));
  });

  it('calls onSuccess callback with tx hash', async () => {
    const { onSuccess } = await goToSuccess();
    expect(onSuccess).toHaveBeenCalledWith('tx_abc123def456');
  });

  it('closes modal on "Done" click', async () => {
    const onClose = vi.fn();
    const { user } = await goToSuccess();
    // Re-render with onClose
    const onConfirm = vi.fn().mockResolvedValue('tx_abc123def456');
    const { props } = renderModal({ onConfirm, onClose });
    await user.click(screen.getAllByRole('button', { name: /review transaction/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /confirm & sign/i })[0]);
    await waitFor(() => screen.getAllByText(/transaction confirmed/i));
    await user.click(screen.getAllByRole('button', { name: /done/i })[0]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('hides stepper on success step', async () => {
    await goToSuccess();
    // Stepper labels should not be visible
    expect(screen.queryByText('Review')).not.toBeInTheDocument();
  });
});

// ── Error step ────────────────────────────────────────────────────────────────

describe('TransactionConfirmModal – error step', () => {
  async function goToError(errorMsg = 'User rejected the request') {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error(errorMsg));
    renderModal({ onConfirm, onError });

    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));

    await waitFor(() => {
      expect(screen.getByText(/transaction failed/i)).toBeInTheDocument();
    });

    return { user, onError };
  }

  it('shows error message', async () => {
    await goToError('User rejected the request');
    expect(screen.getByText('User rejected the request')).toBeInTheDocument();
  });

  it('calls onError callback', async () => {
    const { onError } = await goToError();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('shows retry button', async () => {
    await goToError();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('returns to review step on retry', async () => {
    const { user } = await goToError();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('button', { name: /review transaction/i })).toBeInTheDocument();
  });

  it('shows cancel button that calls onClose', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'));
    const user = userEvent.setup();
    render(
      <TransactionConfirmModal
        open
        transaction={CONTRIBUTION_TX}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
    await user.click(screen.getByRole('button', { name: /review transaction/i }));
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));
    await waitFor(() => screen.getByText(/transaction failed/i));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── Join transaction (no amount) ──────────────────────────────────────────────

describe('TransactionConfirmModal – join transaction', () => {
  it('renders without amount row when amount is undefined', () => {
    renderModal({ transaction: JOIN_TX });
    expect(screen.queryByText('Amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('still shows fee row', () => {
    renderModal({ transaction: JOIN_TX });
    expect(screen.getByText(/estimated network fee/i)).toBeInTheDocument();
  });
});

// ── Extra details ─────────────────────────────────────────────────────────────

describe('TransactionConfirmModal – extra details', () => {
  it('shows extra detail rows in advanced section', async () => {
    const user = userEvent.setup();
    const tx: TransactionDetails = {
      ...CONTRIBUTION_TX,
      extraDetails: [{ label: 'Token', value: 'USDC' }],
    };
    renderModal({ transaction: tx });
    await user.click(screen.getByText(/show transaction details/i));
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });
});
