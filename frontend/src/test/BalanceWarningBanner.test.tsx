import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BalanceWarningBanner } from '../components/BalanceWarningBanner';
import type { BalanceWarning } from '../hooks/useBalanceWarning';

const sufficientWarning: BalanceWarning = {
  isInsufficient: false,
  currentBalance: 1000,
  requiredAmount: 500,
  shortfall: 0,
};

const insufficientWarning: BalanceWarning = {
  isInsufficient: true,
  currentBalance: 200,
  requiredAmount: 750,
  shortfall: 550,
};

describe('BalanceWarningBanner', () => {
  it('renders nothing when balance is sufficient', () => {
    const { container } = render(<BalanceWarningBanner warning={sufficientWarning} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows warning when balance is insufficient', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    expect(screen.getByText('Insufficient Balance')).toBeInTheDocument();
  });

  it('displays current balance', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    expect(screen.getByText(/200\.00 XLM/)).toBeInTheDocument();
  });

  it('displays required amount', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    expect(screen.getByText(/750\.00 XLM/)).toBeInTheDocument();
  });

  it('displays shortfall amount', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    expect(screen.getByText(/550\.00 more XLM/)).toBeInTheDocument();
  });

  it('shows Fund Wallet button linking to stellar.org', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    const link = screen.getByRole('link', { name: /fund wallet/i });
    expect(link).toHaveAttribute('href', 'https://www.stellar.org/lumens/wallets');
  });

  it('dismisses the banner when dismiss button is clicked', () => {
    render(<BalanceWarningBanner warning={insufficientWarning} />);
    expect(screen.getByText('Insufficient Balance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /dismiss warning/i }));
    expect(screen.queryByText('Insufficient Balance')).not.toBeInTheDocument();
  });
});
