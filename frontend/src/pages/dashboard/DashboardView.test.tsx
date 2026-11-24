import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DashboardView, type DashboardViewProps } from './DashboardView';

vi.mock('../../components/dashboard', () => ({
  DashboardSummary: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="summary" data-loading={isLoading} />
  ),
  DashboardActions: () => <div data-testid="actions" />,
  DashboardOverview: ({ isLoading }: { isLoading: boolean }) => (
    <div data-testid="overview" data-loading={isLoading} />
  ),
  DashboardChart: ({ groups }: { groups: unknown[] }) => (
    <div data-testid="chart" data-count={groups.length} />
  ),
  DashboardGroupCard: ({ group, isLoading }: { group?: { name: string }; isLoading?: boolean }) => (
    <div data-testid="group-card" data-loading={Boolean(isLoading)}>
      {group?.name}
    </div>
  ),
  PayoutSchedule: ({ payouts }: { payouts: unknown[] }) => (
    <div data-testid="payouts" data-count={payouts.length} />
  ),
  TransactionTable: ({ transactions }: { transactions: unknown[] }) => (
    <div data-testid="transactions" data-count={transactions.length} />
  ),
  QuickActionSidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('../../components/BalanceWarningBanner', () => ({
  BalanceWarningBanner: ({ warning }: { warning: { shortfall: number } }) => (
    <div data-testid="warning" data-shortfall={warning.shortfall} />
  ),
}));

const balanceWarning = {
  isInsufficient: false,
  currentBalance: 100,
  requiredAmount: 50,
  shortfall: 0,
};

const group = (id: string, name: string) => ({
  id,
  name,
  currentCycle: 1,
  totalCycles: 4,
  contributionAmount: 100,
  currency: 'XLM',
  status: 'active' as const,
});

const makeProps = (overrides: Partial<DashboardViewProps> = {}): DashboardViewProps => ({
  stats: {
    totalBalance: 1000,
    nextPayoutAmount: 100,
    nextPayoutDate: 'May 15, 2026',
    currency: 'XLM',
  },
  groups: [group('1', 'Alpha Circle'), group('2', 'Beta Circle')],
  payouts: [{ id: 'p1', groupName: 'Alpha Circle', amount: 100, date: 'May 15, 2026', status: 'upcoming' }],
  transactions: [
    { id: 't1', type: 'deposit', amount: 100, currency: 'XLM', date: 'May 1, 2026', status: 'paid' },
  ],
  balanceWarning,
  isLoading: false,
  ...overrides,
});

describe('DashboardView', () => {
  it('renders loaded groups and forwards data to the widgets', () => {
    render(<DashboardView {...makeProps()} />);

    expect(screen.getAllByTestId('group-card')).toHaveLength(2);
    expect(screen.getByText('Alpha Circle')).toBeInTheDocument();
    expect(screen.getByTestId('summary')).toHaveAttribute('data-loading', 'false');
    expect(screen.getByTestId('chart')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('payouts')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('transactions')).toHaveAttribute('data-count', '1');
  });

  it('renders four placeholders while loading', () => {
    render(<DashboardView {...makeProps({ groups: [], isLoading: true })} />);

    const cards = screen.getAllByTestId('group-card');
    expect(cards).toHaveLength(4);
    expect(cards.every((card) => card.getAttribute('data-loading') === 'true')).toBe(true);
    expect(screen.getByTestId('summary')).toHaveAttribute('data-loading', 'true');
  });

  it('renders no group cards for an empty loaded group list', () => {
    render(<DashboardView {...makeProps({ groups: [] })} />);

    expect(screen.queryAllByTestId('group-card')).toHaveLength(0);
    expect(screen.getByText('My Groups')).toBeInTheDocument();
  });

  it('passes the balance warning through to the banner', () => {
    render(
      <DashboardView
        {...makeProps({ balanceWarning: { ...balanceWarning, shortfall: 25 } })}
      />
    );

    expect(screen.getByTestId('warning')).toHaveAttribute('data-shortfall', '25');
  });
});
