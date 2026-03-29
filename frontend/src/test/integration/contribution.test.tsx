/**
 * Integration tests: Contribution flow
 *
 * Tests the full ContributeButton interaction: confirmation modal with amount,
 * loading/processing states, success state with tx hash, and error handling.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContributeButton } from '../../components/ContributeButton';

const WALLET_ADDRESS = 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function renderContributeButton(
  props: Partial<React.ComponentProps<typeof ContributeButton>> = {}
) {
  return render(
    <ContributeButton
      amount={100}
      cycleId={3}
      walletAddress={WALLET_ADDRESS}
      {...props}
    />
  );
}

describe('Contribution flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Contribute" button with amount when wallet is connected', () => {
    renderContributeButton();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();
    expect(screen.getByText(/100 XLM/i)).toBeInTheDocument();
  });

  it('shows warning when no wallet address is provided', () => {
    renderContributeButton({ walletAddress: undefined });
    expect(screen.getByText(/connect your wallet to contribute/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeDisabled();
  });

  it('opens confirmation modal with correct amount and cycle when clicked', async () => {
    const user = userEvent.setup();
    renderContributeButton({ amount: 50, cycleId: 7 });

    await user.click(screen.getByRole('button', { name: /contribute/i }));

    expect(screen.getByText(/confirm contribution/i)).toBeInTheDocument();
    expect(screen.getByText(/cycle #7/i)).toBeInTheDocument();
    expect(screen.getAllByText(/50 XLM/i).length).toBeGreaterThan(0);
  });

  it('closes modal and does nothing when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderContributeButton();

    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/confirm contribution/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();
  });

  it('shows processing state after confirming', async () => {
    const user = userEvent.setup();
    renderContributeButton();

    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    // Should transition through a loading state
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });
  });

  it('shows success state and calls onSuccess after transaction completes', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    renderContributeButton({ onSuccess });

    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/contributed!/i)).toBeInTheDocument();
        expect(screen.getByText(/transaction confirmed/i)).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^tx_/));
  }, 15000);

  it('shows error state and calls onError when transaction fails', async () => {
    // The component has a ~10% random failure rate; force it by mocking Math.random
    const user = userEvent.setup();
    const onError = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0); // always triggers the rejection path

    renderContributeButton({ onError });

    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
        expect(screen.getByText(/user rejected/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('resets to idle state when "Try Again" is clicked after error', async () => {
    const user = userEvent.setup();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderContributeButton();

    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await user.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => screen.getByText(/try again/i), { timeout: 5000 });

    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();

    vi.spyOn(Math, 'random').mockRestore();
  });

  it('is disabled when disabled prop is true', () => {
    renderContributeButton({ disabled: true });
    expect(screen.getByRole('button', { name: /contribute/i })).toBeDisabled();
  });
});
