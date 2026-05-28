import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriggerPayoutButton } from '../components/TriggerPayoutButton';

// ── Mock useContract ──────────────────────────────────────────────────────────

const mockExecutePayout = vi.fn();

vi.mock('../hooks/useContract', () => ({
  useContract: () => ({
    executePayout: mockExecutePayout,
    loading: { executePayout: false },
  }),
}));

// ── Mock useToast ─────────────────────────────────────────────────────────────

const mockAddToast = vi.fn();

vi.mock('../components/Toast/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TriggerPayoutButton', () => {
  it('renders the trigger button', () => {
    render(<TriggerPayoutButton groupId="1" />);
    expect(screen.getByRole('button', { name: /trigger payout/i })).toBeInTheDocument();
  });

  it('opens confirmation dialog when button is clicked', async () => {
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="1" />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm payout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="1" />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('Confirm Payout')).not.toBeInTheDocument();
    });
  });

  it('calls executePayout with correct groupId on confirm', async () => {
    mockExecutePayout.mockResolvedValue({ txHash: 'tx_abc123', error: null });
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="42" />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));
    await user.click(screen.getByRole('button', { name: /confirm payout/i }));

    await waitFor(() => {
      expect(mockExecutePayout).toHaveBeenCalledWith({ groupId: 42n });
    });
  });

  it('shows success toast and calls onSuccess after successful payout', async () => {
    mockExecutePayout.mockResolvedValue({ txHash: 'tx_success', error: null });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="1" onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));
    await user.click(screen.getByRole('button', { name: /confirm payout/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: expect.stringContaining('tx_success') }),
      );
      expect(onSuccess).toHaveBeenCalledWith('tx_success');
    });
  });

  it('shows error toast when payout fails', async () => {
    mockExecutePayout.mockResolvedValue({
      txHash: null,
      error: { message: 'Insufficient funds' },
    });
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="1" />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));
    await user.click(screen.getByRole('button', { name: /confirm payout/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: 'Insufficient funds' }),
      );
    });
  });

  it('does not call onSuccess when payout fails', async () => {
    mockExecutePayout.mockResolvedValue({
      txHash: null,
      error: { message: 'Contract error' },
    });
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<TriggerPayoutButton groupId="1" onSuccess={onSuccess} />);

    await user.click(screen.getByRole('button', { name: /trigger payout/i }));
    await user.click(screen.getByRole('button', { name: /confirm payout/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
