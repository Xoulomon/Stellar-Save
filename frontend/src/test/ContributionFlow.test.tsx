import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ContributionFlow } from '../components/ContributionFlow';

const LONG_TIMEOUT = 10000;

beforeEach(() => {
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      createOscillator: () => ({
        connect: vi.fn(),
        type: '',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      }),
      destination: {},
      currentTime: 0,
    })),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderFlow(props = {}) {
  const defaultProps = {
    cycleId: 3,
    walletAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  };
  return render(<ContributionFlow {...defaultProps} {...props} />);
}

describe('ContributionFlow — initial state', () => {
  it('renders the form with amount input', () => {
    renderFlow();
    expect(screen.getByLabelText(/Contribution Amount/)).toBeInTheDocument();
  });

  it('shows Contribute button', () => {
    renderFlow();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();
  });

  it('does not show wallet warning when walletAddress is provided', () => {
    renderFlow();
    expect(screen.queryByText(/Connect your wallet/i)).not.toBeInTheDocument();
  });

  it('shows wallet warning when walletAddress is not provided', () => {
    renderFlow({ walletAddress: undefined });
    expect(screen.getByText(/Connect your wallet/i)).toBeInTheDocument();
  });

  it('disables input and submit when walletAddress is missing', () => {
    renderFlow({ walletAddress: undefined });
    expect(screen.getByLabelText(/Contribution Amount/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeDisabled();
  });

  it('shows helper text with min/max values', () => {
    renderFlow({ minAmount: 5, maxAmount: 5000 });
    const input = screen.getByLabelText(/Contribution Amount/);
    expect(input).toHaveAccessibleDescription(/Min: 5.*Max: 5,000/);
  });

  it('pre-fills amount when defaultAmount is provided', () => {
    renderFlow({ defaultAmount: 50 });
    const input = screen.getByLabelText(/Contribution Amount/);
    expect(input).toHaveValue(50);
  });

  it('renders quick-select chips when defaultAmount is provided', () => {
    renderFlow({ defaultAmount: 100 });
    expect(screen.getByText('50 XLM')).toBeInTheDocument();
    expect(screen.getByText('100 XLM')).toBeInTheDocument();
    expect(screen.getByText('200 XLM')).toBeInTheDocument();
  });

  it('does not render quick-select chips without defaultAmount', () => {
    renderFlow();
    expect(screen.queryByText('50 XLM')).not.toBeInTheDocument();
  });

  it('does not show any status alert initially', () => {
    renderFlow();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ContributionFlow — amount validation', () => {
  it('shows error for empty amount on submit', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 1, maxAmount: 100 });
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Please enter a valid amount.')).toBeInTheDocument();
  });

  it('shows error for negative amount on submit', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 1, maxAmount: 100 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.type(input, '-10');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Amount must be greater than 0.')).toBeInTheDocument();
  });

  it('shows error for amount below minimum', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 10, maxAmount: 100 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Minimum contribution is 10 XLM.')).toBeInTheDocument();
  });

  it('shows error for amount above maximum', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 1, maxAmount: 50 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.type(input, '100');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Maximum contribution is 50 XLM.')).toBeInTheDocument();
  });

  it('clears field error when user types after validation failure', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 1, maxAmount: 50 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.type(input, '100');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Maximum contribution is 50 XLM.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '25');
    expect(screen.queryByText('Maximum contribution is 50 XLM.')).not.toBeInTheDocument();
  });
});

describe('ContributionFlow — quick-select chips', () => {
  it('sets amount when chip is clicked', async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 100 });
    await user.click(screen.getByText('200 XLM'));
    const input = screen.getByLabelText(/Contribution Amount/);
    expect(input).toHaveValue(200);
  });

  it('highlights selected chip', async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 100 });
    await user.click(screen.getByText('200 XLM'));
    const chip = screen.getByText('200 XLM');
    expect(chip).toBeInTheDocument();
  });
});

describe('ContributionFlow — confirmation dialog', () => {
  it('opens confirmation dialog on valid submit', async () => {
    const user = userEvent.setup();
    renderFlow({ cycleId: 5, defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.clear(input);
    await user.type(input, '75');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Cycle #5/)).toBeInTheDocument();
  });

  it('shows amount in confirmation dialog', async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    const amounts = screen.getAllByText(/50/);
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('cancels confirmation dialog without submitting', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 1, maxAmount: 1000, defaultAmount: 25 });
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

const LONG_TEST_TIMEOUT = 15000;

describe('ContributionFlow — success flow', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
  });

  async function confirmSuccess(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => { expect(screen.getByRole('dialog')).toBeInTheDocument(); }, { timeout: LONG_TIMEOUT });
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { name: /Contribution Successful/i });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    }, { timeout: LONG_TIMEOUT });
  }

  it('shows success message after signing', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderFlow({ cycleId: 2, defaultAmount: 100, minAmount: 1, maxAmount: 1000, onSuccess });
    await confirmSuccess(user);
    expect(screen.getByText(/100 XLM contributed to Cycle #2/)).toBeInTheDocument();
  });

  it('calls onSuccess with tx hash and amount', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderFlow({ cycleId: 2, defaultAmount: 100, minAmount: 1, maxAmount: 1000, onSuccess });
    await confirmSuccess(user);
    expect(onSuccess).toHaveBeenCalledWith(expect.stringMatching(/^tx_/), 100);
  });

  it('shows Stellar Explorer link after success', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmSuccess(user);
    const links = screen.getAllByText(/View on Stellar Explorer/);
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Make Another Contribution button after success', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmSuccess(user);
    expect(screen.getByRole('button', { name: /Make Another Contribution/i })).toBeInTheDocument();
  });

  it('resets form when Make Another Contribution is clicked', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmSuccess(user);
    await user.click(screen.getByRole('button', { name: /Make Another Contribution/i }));
    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();
  });

  it('shows New button in status banner and resets on click', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmSuccess(user);
    await user.click(screen.getByRole('button', { name: /New/i }));
    expect(screen.getByRole('button', { name: /contribute/i })).toBeInTheDocument();
  });
});

describe('ContributionFlow — error and retry', () => {
  async function confirmError(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => { expect(screen.getByRole('dialog')).toBeInTheDocument(); }, { timeout: LONG_TIMEOUT });
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));
    await waitFor(() => { expect(screen.getByText(/Transaction failed/)).toBeInTheDocument(); }, { timeout: LONG_TIMEOUT });
  }

  it('shows error message when user rejects transaction', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    const onError = vi.fn();
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000, onError });
    await confirmError(user);
    expect(onError).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('shows error status alert with retry button', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmError(user);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows Try Again button next to form after error', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmError(user);
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('retry clears error and shows form again', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000 });
    await confirmError(user);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.queryByText(/Transaction failed/)).not.toBeInTheDocument();
  });

  it('succeeds after retry when random returns high value', { timeout: LONG_TEST_TIMEOUT }, async () => {
    const mockMath = vi.spyOn(Math, 'random');
    mockMath.mockReturnValue(0.04);
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000, onSuccess });
    await confirmError(user);
    mockMath.mockReset();
    mockMath.mockReturnValue(0.9);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => { expect(screen.getByRole('dialog')).toBeInTheDocument(); }, { timeout: LONG_TIMEOUT });
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));
    await waitFor(() => {
      const headings = screen.getAllByRole('heading', { name: /Contribution Successful/i });
      expect(headings.length).toBeGreaterThanOrEqual(1);
    }, { timeout: LONG_TIMEOUT });
    expect(onSuccess).toHaveBeenCalled();
  });
});

describe('ContributionFlow — disabled state', () => {
  it('disables input and submit when disabled prop is true', () => {
    renderFlow({ disabled: true });
    expect(screen.getByLabelText(/Contribution Amount/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /contribute/i })).toBeDisabled();
  });

  it('disables chips when disabled prop is true', () => {
    renderFlow({ disabled: true, defaultAmount: 100 });
    const chips = screen.getAllByRole('button').filter(b => b.textContent?.includes('XLM'));
    chips.forEach(chip => {
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    });
  });
});

describe('ContributionFlow — custom min/max', () => {
  it('accepts custom minAmount and maxAmount', async () => {
    const user = userEvent.setup();
    renderFlow({ minAmount: 5, maxAmount: 25, defaultAmount: 10 });
    const input = screen.getByLabelText(/Contribution Amount/);
    await user.clear(input);
    await user.type(input, '30');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Maximum contribution is 25 XLM.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    expect(screen.getByText('Minimum contribution is 5 XLM.')).toBeInTheDocument();
  });
});

describe('ContributionFlow — onError callback', () => {
  it('calls onError when transaction fails', { timeout: LONG_TEST_TIMEOUT }, async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.04);
    const onError = vi.fn();
    const user = userEvent.setup();
    renderFlow({ defaultAmount: 50, minAmount: 1, maxAmount: 1000, onError });
    await user.click(screen.getByRole('button', { name: /contribute/i }));
    await waitFor(() => { expect(screen.getByRole('dialog')).toBeInTheDocument(); }, { timeout: LONG_TIMEOUT });
    await user.click(screen.getByRole('button', { name: /confirm & sign/i }));
    await waitFor(() => { expect(onError).toHaveBeenCalled(); }, { timeout: LONG_TIMEOUT });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'User rejected the transaction in wallet.' }),
    );
  });
});
