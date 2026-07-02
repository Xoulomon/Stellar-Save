import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PayoutStatusScreen } from '../components/PayoutStatusScreen';
import type { PayoutQueueData } from '../types/contribution';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ADDRESS = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF';
const OTHER_ADDRESS = 'GDEF1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF';
const PAID_ADDRESS = 'GPAID234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEF';
const TX_HASH = 'tx_abc123def456789';

const BASE_DATA: PayoutQueueData = {
  cycleId: 2,
  totalMembers: 4,
  entries: [
    {
      position: 1,
      memberAddress: PAID_ADDRESS,
      memberName: 'Alice',
      estimatedDate: new Date('2026-05-01'),
      amount: 400,
      status: 'completed',
      txHash: TX_HASH,
      paidAt: new Date('2026-05-01'),
    },
    {
      position: 2,
      memberAddress: USER_ADDRESS,
      memberName: 'Bob',
      estimatedDate: new Date('2026-06-01'),
      amount: 400,
      status: 'next',
    },
    {
      position: 3,
      memberAddress: OTHER_ADDRESS,
      memberName: 'Carol',
      estimatedDate: new Date('2026-07-01'),
      amount: 400,
      status: 'upcoming',
    },
    {
      position: 4,
      memberAddress: 'GOTHER1234567890',
      estimatedDate: new Date('2026-08-01'),
      amount: 400,
      status: 'upcoming',
    },
  ],
};

// ── Queue position ─────────────────────────────────────────────────────────────

describe('PayoutStatusScreen — queue position', () => {
  it('shows the group name and cycle header', () => {
    render(
      <PayoutStatusScreen
        data={BASE_DATA}
        groupName="Community Savings Circle"
        currentUserAddress={USER_ADDRESS}
      />
    );
    expect(screen.getByText('Community Savings Circle')).toBeInTheDocument();
    expect(screen.getByText(/Cycle #2/)).toBeInTheDocument();
  });

  it("shows the user's queue position number", () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('shows total member count alongside position', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText(/4 member/i)).toBeInTheDocument();
  });

  it('labels the user position as "Up Next!" when status is next', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText('Up Next!')).toBeInTheDocument();
  });

  it('labels the user position as "Paid" when status is completed', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={PAID_ADDRESS} />
    );
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('shows progress: 1 of 4 paid out', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText(/1 of 4 paid out/i)).toBeInTheDocument();
  });
});

// ── Estimated date ─────────────────────────────────────────────────────────────

describe('PayoutStatusScreen — estimated date', () => {
  it("shows the user's estimated payout date", () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    // Jun 1, 2026 formatted as "Jun 1, 2026"
    expect(screen.getByText(/Jun 1, 2026/i)).toBeInTheDocument();
  });

  it('shows "Received on" label when payout is completed', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={PAID_ADDRESS} />
    );
    expect(screen.getByText(/Received on/i)).toBeInTheDocument();
  });

  it('shows "Estimated date" label when payout is upcoming/next', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText(/Estimated date/i)).toBeInTheDocument();
  });

  it('shows payout amount for current user', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(screen.getByText(/400 XLM/i)).toBeInTheDocument();
  });
});

// ── Explorer link ──────────────────────────────────────────────────────────────

describe('PayoutStatusScreen — explorer link', () => {
  it('shows explorer link when user has a paid txHash', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={PAID_ADDRESS} />
    );
    const link = screen.getByRole('link', { name: /view payout transaction/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining(TX_HASH));
  });

  it('explorer link opens in a new tab with noopener noreferrer', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={PAID_ADDRESS} />
    );
    const link = screen.getByRole('link', { name: /view payout transaction/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not show explorer link when payout is not yet completed', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={USER_ADDRESS} />
    );
    expect(
      screen.queryByRole('link', { name: /view payout transaction/i })
    ).not.toBeInTheDocument();
  });

  it('explorer link URL contains the stellar.expert domain', () => {
    render(
      <PayoutStatusScreen data={BASE_DATA} currentUserAddress={PAID_ADDRESS} />
    );
    const link = screen.getByRole('link', { name: /view payout transaction/i });
    expect(link.getAttribute('href')).toMatch(/stellar\.expert/);
  });
});

// ── Wallet not connected ───────────────────────────────────────────────────────

describe('PayoutStatusScreen — wallet not connected', () => {
  it('shows connect wallet prompt when no address is provided', () => {
    render(<PayoutStatusScreen data={BASE_DATA} />);
    expect(
      screen.getByText(/connect your wallet/i)
    ).toBeInTheDocument();
  });

  it('does not render the user position card without an address', () => {
    render(<PayoutStatusScreen data={BASE_DATA} />);
    expect(screen.queryByText('Your Payout Position')).not.toBeInTheDocument();
  });

  it('still shows group progress even without wallet connection', () => {
    render(<PayoutStatusScreen data={BASE_DATA} />);
    expect(screen.getByText(/1 of 4 paid out/i)).toBeInTheDocument();
  });

  it('uses data.currentUserAddress as fallback when prop is not given', () => {
    const dataWithUser: PayoutQueueData = {
      ...BASE_DATA,
      currentUserAddress: USER_ADDRESS,
    };
    render(<PayoutStatusScreen data={dataWithUser} />);
    expect(screen.getByText('Your Payout Position')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
});
