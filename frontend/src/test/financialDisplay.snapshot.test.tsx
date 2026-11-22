/**
 * Tests for the financially-sensitive display components.
 *
 * These are the components where a rendering regression is a financial bug: a
 * user reads an amount off the screen and acts on it. Formatted amounts,
 * percentages, and totals are asserted explicitly against known values (see
 * #1916) so a formatting change only passes when the displayed number is
 * still correct. A snapshot is kept only where there is no single value to
 * check and the thing worth guarding is the overall structure - a loading
 * state, an empty state, or (for PayoutQueue) a known bug deliberately
 * captured below.
 *
 * ## Why these ten
 *
 * Each one renders a number a user would act on, and each formats that number
 * differently, so together they cover the formatting surface that matters:
 *
 *  | Component                   | Formats                            |
 *  | --------------------------- | ---------------------------------- |
 *  | BalanceDisplay              | Stellar balances, relative time    |
 *  | UserStats                   | Totals with thousands separators   |
 *  | StreakDisplay               | Progress %, milestone labels       |
 *  | StaleDataBanner             | Cached/stale data warning          |
 *  | CycleProgress               | Cycle %, amounts, time remaining   |
 *  | GroupMetrics                | Rates, health score, durations     |
 *  | MemberCard                  | Totals, payout position ordinals   |
 *  | PayoutQueue                 | Payout amounts, dates, positions   |
 *  | TransactionTables           | Signed/unsigned amounts, statuses  |
 *  | dashboard/TransactionTable  | Signed amounts, currencies, chips  |
 *
 * ## Determinism
 *
 * A snapshot that changes depending on when or where it ran is worse than no
 * snapshot, because it trains reviewers to accept diffs without reading them.
 * Three things are pinned here:
 *
 * 1. `process.env.TZ = 'UTC'` - several components call `toLocaleDateString()`
 *    with no explicit time zone, so the same instant renders as a different
 *    calendar day depending on the machine. Set before any test runs.
 * 2. Fake timers with an explicit `setSystemTime` - `CycleProgress` and
 *    `BalanceDisplay` both measure against `Date.now()`.
 * 3. Fixed mock data with mid-day UTC timestamps - a date at midnight UTC
 *    still moves a day backwards in any negative-offset zone.
 *
 * `TransactionTables` renders one date column through a bare
 * `toLocaleDateString()` with no locale argument, so it also depends on the
 * runtime default locale. That is a latent flakiness bug in the component
 * rather than in the test; see the review guidance in
 * `frontend/src/test/SNAPSHOT_REVIEW.md` before accepting a diff there.
 */
process.env.TZ = 'UTC';

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BalanceDisplay } from '../components/BalanceDisplay';
import { CycleProgress } from '../components/CycleProgress';
import { TransactionTable as DashboardTransactionTable } from '../components/dashboard/TransactionTable';
import { GroupMetrics } from '../components/GroupMetrics';
import { MemberCard } from '../components/MemberCard';
import { PayoutQueue } from '../components/PayoutQueue';
import { StaleDataBanner } from '../components/StaleDataBanner';
import { StreakDisplay } from '../components/StreakDisplay';
import TransactionTables from '../components/TransactionTables';
import { UserStats } from '../components/UserStats';

import type { PayoutQueueData } from '../types/contribution';
import type { Transaction as DashboardTransaction } from '../types/dashboard';
import type { Transaction } from '../types/transaction';
import type { DetailedGroup, GroupContribution, GroupCycle } from '../utils/groupApi';

// A single fixed "now" for every test that measures elapsed time.
const NOW = new Date('2026-06-15T12:00:00Z');

vi.mock('../hooks/useBalance', () => ({
  useBalance: () => mockUseBalance(),
}));

const mockUseBalance = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  mockUseBalance.mockReset();
});

describe('BalanceDisplay snapshots', () => {
  it('prompts to connect when no wallet is attached', () => {
    mockUseBalance.mockReturnValue({
      xlmBalance: null,
      allBalances: [],
      isLoading: false,
      error: null,
      lastUpdated: null,
      refresh: vi.fn(),
      hasAddress: false,
    });

    const { container } = render(<BalanceDisplay />);
    expect(container.querySelector('.balance-display__empty')).toHaveTextContent(
      'Connect your wallet to view balance'
    );
  });

  it('renders the XLM balance with a relative timestamp', () => {
    mockUseBalance.mockReturnValue({
      xlmBalance: '1234.5678901',
      allBalances: [],
      isLoading: false,
      error: null,
      lastUpdated: new Date('2026-06-15T11:58:30Z'),
      refresh: vi.fn(),
      hasAddress: true,
    });

    const { container } = render(<BalanceDisplay />);
    expect(container.querySelector('.balance-display__amount')).toHaveTextContent('1,234.5678901');
    expect(container.querySelector('.balance-display__currency')).toHaveTextContent('XLM');
    expect(container.querySelector('.balance-display__timestamp')).toHaveTextContent('Updated 1m ago');
  });

  it('renders every asset when showAllBalances is set', () => {
    mockUseBalance.mockReturnValue({
      xlmBalance: '1234.5678901',
      allBalances: [
        { asset_type: 'native', balance: '1234.5678901' },
        { asset_type: 'credit_alphanum4', asset_code: 'USDC', balance: '5000' },
        { asset_type: 'credit_alphanum4', asset_code: 'EURC', balance: '2500.5' },
      ],
      isLoading: false,
      error: null,
      lastUpdated: new Date('2026-06-15T11:58:30Z'),
      refresh: vi.fn(),
      hasAddress: true,
    });

    const { container } = render(<BalanceDisplay showAllBalances />);
    const assets = container.querySelectorAll('.balance-display__asset');
    expect(assets).toHaveLength(3);
    expect(assets[0]).toHaveTextContent('XLM');
    expect(assets[0]).toHaveTextContent('1,234.5678901');
    expect(assets[1]).toHaveTextContent('USDC');
    expect(assets[1]).toHaveTextContent('5,000.00');
    expect(assets[2]).toHaveTextContent('EURC');
    expect(assets[2]).toHaveTextContent('2,500.50');
  });

  it('surfaces a balance fetch error', () => {
    mockUseBalance.mockReturnValue({
      xlmBalance: null,
      allBalances: [],
      isLoading: false,
      error: 'Failed to load account: horizon timeout',
      lastUpdated: null,
      refresh: vi.fn(),
      hasAddress: true,
    });

    const { container } = render(<BalanceDisplay />);
    expect(container.querySelector('.balance-display__error-message')).toHaveTextContent(
      'Failed to load account: horizon timeout'
    );
    expect(container.querySelector('.balance-display__amount')).toHaveTextContent('0.00');
  });
});

describe('UserStats snapshots', () => {
  const stats = {
    totalContributed: 12500,
    totalReceived: 8200.5,
    groupsJoined: 4,
    activeGroups: 3,
    completedCycles: 17,
    averageContribution: 312.5,
  };

  it('renders every total with thousands separators', () => {
    const { container } = render(<UserStats stats={stats} />);
    const values = container.querySelectorAll('.stat-value');
    expect(values[0]).toHaveTextContent('12,500 XLM');
    expect(values[1]).toHaveTextContent('8,200.5 XLM');
    expect(values[2]).toHaveTextContent('4');
    expect(values[3]).toHaveTextContent('3');
    expect(values[4]).toHaveTextContent('17');
    expect(values[5]).toHaveTextContent('312.5 XLM');
  });

  it('renders zeroes without collapsing a stat', () => {
    const { container } = render(
      <UserStats
        stats={{
          totalContributed: 0,
          totalReceived: 0,
          groupsJoined: 0,
          activeGroups: 0,
          completedCycles: 0,
          averageContribution: 0,
        }}
      />
    );
    const values = container.querySelectorAll('.stat-value');
    expect(values[0]).toHaveTextContent('0 XLM');
    expect(values[1]).toHaveTextContent('0 XLM');
    expect(values[2]).toHaveTextContent('0');
    expect(values[3]).toHaveTextContent('0');
    expect(values[4]).toHaveTextContent('0');
    expect(values[5]).toHaveTextContent('0 XLM');
  });

  it('renders a non-XLM currency label', () => {
    const { container } = render(<UserStats stats={stats} currency="USDC" />);
    const values = container.querySelectorAll('.stat-value');
    expect(values[0]).toHaveTextContent('12,500 USDC');
    expect(values[1]).toHaveTextContent('8,200.5 USDC');
    expect(values[5]).toHaveTextContent('312.5 USDC');
  });
});

describe('StreakDisplay snapshots', () => {
  it('renders streaks with the next milestone and earned badges', () => {
    const { container } = render(<StreakDisplay currentStreak={12} longestStreak={19} />);
    expect(screen.getByTestId('current-streak')).toHaveTextContent('12');
    expect(screen.getByTestId('longest-streak')).toHaveTextContent('19');
    expect(container.querySelector('.streak-progress-pct')).toHaveTextContent('60%');
    expect(container.querySelector('.streak-progress-sub')).toHaveTextContent('12 / 20 contributions');
    expect(screen.getByTestId('badge-5')).toBeInTheDocument();
    expect(screen.getByTestId('badge-10')).toBeInTheDocument();
    expect(screen.queryByTestId('badge-20')).not.toBeInTheDocument();
  });

  it('renders the at-risk warning', () => {
    const { container } = render(<StreakDisplay currentStreak={3} longestStreak={8} atRisk />);
    expect(screen.getByTestId('current-streak')).toHaveTextContent('3');
    expect(screen.getByTestId('longest-streak')).toHaveTextContent('8');
    expect(screen.getByTestId('streak-warning')).toHaveTextContent(/at risk/i);
    expect(container.querySelector('.streak-progress-pct')).toHaveTextContent('60%');
    expect(screen.getByTestId('no-badges')).toBeInTheDocument();
  });

  it('renders the empty badge state below the first threshold', () => {
    const { container } = render(<StreakDisplay currentStreak={0} longestStreak={0} />);
    expect(screen.getByTestId('current-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('longest-streak')).toHaveTextContent('0');
    expect(container.querySelector('.streak-progress-pct')).toHaveTextContent('0%');
    expect(screen.getByTestId('no-badges')).toBeInTheDocument();
  });
});

describe('StaleDataBanner snapshots', () => {
  it('renders nothing when data is neither stale nor cached', () => {
    const { container } = render(<StaleDataBanner />);
    expect(container).toMatchSnapshot();
  });

  it('renders the stale warning with a refresh action', () => {
    const { container } = render(<StaleDataBanner isStale onRefresh={() => {}} />);
    expect(container).toMatchSnapshot();
  });

  it('renders the cached notice without a refresh action', () => {
    const { container } = render(<StaleDataBanner fromCache />);
    expect(container).toMatchSnapshot();
  });
});

describe('CycleProgress snapshots', () => {
  it('renders an active cycle part-way through', () => {
    const { container } = render(
      <CycleProgress
        cycleNumber={4}
        deadline={new Date('2026-06-20T12:00:00Z')}
        contributedCount={7}
        totalMembers={10}
        targetAmount={5000}
        currentAmount={3500}
      />
    );
    const stats = container.querySelectorAll('.cycle-progress-stats .stat-value');
    expect(stats[0]).toHaveTextContent('7/10');
    expect(stats[1]).toHaveTextContent('3,500 XLM');
    expect(stats[2]).toHaveTextContent('5,000 XLM');
    expect(container.querySelector('.time-value')).toHaveTextContent('5d 0h');
    const percentages = container.querySelectorAll('.progress-percentage');
    expect(percentages[0]).toHaveTextContent('70%');
    expect(percentages[1]).toHaveTextContent('70%');
    expect(container.querySelector('.cycle-progress-complete')).not.toBeInTheDocument();
  });

  it('renders a completed cycle at 100%', () => {
    const { container } = render(
      <CycleProgress
        cycleNumber={3}
        deadline={new Date('2026-06-10T12:00:00Z')}
        contributedCount={10}
        totalMembers={10}
        targetAmount={5000}
        currentAmount={5000}
        status="completed"
      />
    );
    const stats = container.querySelectorAll('.cycle-progress-stats .stat-value');
    expect(stats[0]).toHaveTextContent('10/10');
    expect(stats[1]).toHaveTextContent('5,000 XLM');
    expect(stats[2]).toHaveTextContent('5,000 XLM');
    expect(container.querySelector('.time-value')).toHaveTextContent('Ended');
    const percentages = container.querySelectorAll('.progress-percentage');
    expect(percentages[0]).toHaveTextContent('100%');
    expect(percentages[1]).toHaveTextContent('100%');
    expect(container.querySelector('.cycle-progress-complete')).toHaveTextContent('Cycle complete');
  });

  it('renders an overdue cycle', () => {
    const { container } = render(
      <CycleProgress
        cycleNumber={2}
        deadline={new Date('2026-06-01T12:00:00Z')}
        contributedCount={2}
        totalMembers={10}
        targetAmount={5000}
        currentAmount={1000}
        status="pending"
      />
    );
    const stats = container.querySelectorAll('.cycle-progress-stats .stat-value');
    expect(stats[0]).toHaveTextContent('2/10');
    expect(stats[1]).toHaveTextContent('1,000 XLM');
    expect(stats[2]).toHaveTextContent('5,000 XLM');
    expect(container.querySelector('.time-value')).toHaveTextContent('Ended');
    const percentages = container.querySelectorAll('.progress-percentage');
    expect(percentages[0]).toHaveTextContent('20%');
    expect(percentages[1]).toHaveTextContent('20%');
    expect(container.querySelector('.cycle-progress-complete')).not.toBeInTheDocument();
  });
});

describe('GroupMetrics snapshots', () => {
  const group: DetailedGroup = {
    id: '1',
    name: 'Family Savings Circle',
    memberCount: 10,
    contributionAmount: 500,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-10T12:00:00Z'),
    totalMembers: 10,
    targetAmount: 5000,
    currentAmount: 3500,
    contributionFrequency: 'monthly',
    members: [],
    contributions: [],
    cycles: [],
  };

  const contributions: GroupContribution[] = [
    {
      id: 'c1',
      memberId: 'm1',
      amount: 500,
      timestamp: new Date('2026-05-01T12:00:00Z'),
      transactionHash: 'tx1',
      status: 'completed',
    },
    {
      id: 'c2',
      memberId: 'm2',
      amount: 500,
      timestamp: new Date('2026-05-01T18:00:00Z'),
      transactionHash: 'tx2',
      status: 'completed',
    },
    {
      id: 'c3',
      memberId: 'm3',
      amount: 500,
      timestamp: new Date('2026-05-03T12:00:00Z'),
      transactionHash: 'tx3',
      status: 'completed',
    },
    {
      id: 'c4',
      memberId: 'm4',
      amount: 500,
      timestamp: new Date('2026-06-01T12:00:00Z'),
      transactionHash: 'tx4',
      status: 'pending',
    },
  ];

  const cycles: GroupCycle[] = [
    {
      cycleNumber: 1,
      startDate: new Date('2026-03-01T12:00:00Z'),
      endDate: new Date('2026-04-01T12:00:00Z'),
      targetAmount: 5000,
      currentAmount: 4000,
      status: 'completed',
    },
    {
      cycleNumber: 2,
      startDate: new Date('2026-04-01T12:00:00Z'),
      endDate: new Date('2026-05-01T12:00:00Z'),
      targetAmount: 5000,
      currentAmount: 4800,
      status: 'completed',
    },
  ];

  it('renders completion rate, average time, and health score', () => {
    render(<GroupMetrics group={group} contributions={contributions} cycles={cycles} />);
    expect(screen.getByTestId('completion-rate-value')).toHaveTextContent('75%');
    expect(screen.getByTestId('average-time-value')).toHaveTextContent('1.0 days');
    expect(screen.getByTestId('health-score-value')).toHaveTextContent('79/100');
  });

  it('renders zeroes with no contributions or cycles', () => {
    render(<GroupMetrics group={group} contributions={[]} cycles={[]} />);
    expect(screen.getByTestId('completion-rate-value')).toHaveTextContent('0%');
    expect(screen.getByTestId('average-time-value')).toHaveTextContent('0 hours');
    expect(screen.getByTestId('health-score-value')).toHaveTextContent('24/100');
  });
});

describe('MemberCard snapshots', () => {
  const member = {
    address: 'GAX7BQJ2N3V5YRQ4Z8W6KTPY1M3N9QRS7T2V4X6Z8A0B2C4D6E8F',
    name: 'Ada Lovelace',
    joinDate: new Date('2026-02-14T12:00:00Z'),
    contributionCount: 8,
    totalContributed: 4000,
    payoutPosition: 3,
    totalMembers: 10,
    hasReceivedPayout: false,
    status: 'active' as const,
  };

  it('renders the full card with totals and payout position', () => {
    const { container } = render(<MemberCard member={member} />);
    const values = container.querySelectorAll('.grid-cols-3 p.text-lg');
    expect(values[0]).toHaveTextContent('8');
    expect(values[1]).toHaveTextContent('4000 XLM');
    expect(values[2]).toHaveTextContent('3rd');
    expect(container.querySelector('.grid-cols-3')).toHaveTextContent('of 10');
    expect(container.querySelector('.px-5.pb-4')).toHaveTextContent('3 / 10');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });

  it('renders the current user with a You marker', () => {
    const { container } = render(<MemberCard member={member} isCurrentUser />);
    expect(screen.getByText('You')).toBeInTheDocument();
    const values = container.querySelectorAll('.grid-cols-3 p.text-lg');
    expect(values[1]).toHaveTextContent('4000 XLM');
    expect(values[2]).toHaveTextContent('3rd');
  });

  it('renders a member who has already been paid', () => {
    const { container } = render(
      <MemberCard
        member={{
          ...member,
          name: 'Grace Hopper',
          payoutPosition: 1,
          hasReceivedPayout: true,
          status: 'inactive',
        }}
      />
    );
    const values = container.querySelectorAll('.grid-cols-3 p.text-lg');
    expect(values[1]).toHaveTextContent('4000 XLM');
    expect(values[2]).toHaveTextContent('1st');
    expect(container.querySelector('.grid-cols-3')).toHaveTextContent('Received');
    expect(container.querySelector('.px-5.pb-4')).toHaveTextContent('1 / 10');
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('renders the compact variant', () => {
    render(<MemberCard member={member} compact />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('8 contributions')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

describe('PayoutQueue snapshots', () => {
  const data: PayoutQueueData = {
    cycleId: 5,
    totalMembers: 6,
    currentUserAddress: 'GAX7BQJ2N3V5YRQ4Z8W6KTPY1M3N9QRS7T2V4X6Z8A0B2C4D6E8F',
    entries: [
      {
        position: 1,
        memberAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWWH',
        memberName: 'Ada Lovelace',
        estimatedDate: new Date('2026-05-01T12:00:00Z'),
        amount: 500,
        status: 'completed',
        txHash: 'abc123',
        paidAt: new Date('2026-05-01T12:00:00Z'),
      },
      {
        position: 2,
        memberAddress: 'GAX7BQJ2N3V5YRQ4Z8W6KTPY1M3N9QRS7T2V4X6Z8A0B2C4D6E8F',
        memberName: 'Grace Hopper',
        estimatedDate: new Date('2026-06-01T12:00:00Z'),
        amount: 750.25,
        status: 'next',
      },
      {
        position: 3,
        memberAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        estimatedDate: new Date('2026-07-01T12:00:00Z'),
        amount: 1000,
        status: 'upcoming',
      },
    ],
  };

  it('renders completed, next, and upcoming payouts', () => {
    const { container } = render(<PayoutQueue data={data} />);
    const header = container.querySelector('.bg-gradient-to-r.from-indigo-600');
    expect(header).toHaveTextContent('Cycle #5');
    expect(header).toHaveTextContent('1 of 6 paid out');
    expect(header).toHaveTextContent('17%');

    const amounts = container.querySelectorAll('.text-sm.font-bold.text-gray-800');
    expect(amounts[0]).toHaveTextContent('500 XLM');
    expect(amounts[1]).toHaveTextContent('750.25 XLM');
    expect(amounts[2]).toHaveTextContent('1000 XLM');

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();

    const footer = container.querySelector('.border-t.border-gray-100.px-5.py-3');
    expect(footer).toHaveTextContent('6 total members');
    expect(footer).toHaveTextContent('2 remaining');
  });

  /**
   * NOTE: this snapshot currently records `NaN%` in the progress header.
   *
   * `PayoutQueue` computes `progress = (completedCount / totalMembers) * 100`
   * with no guard, so a group with zero members divides 0 by 0. That is a real
   * bug, tracked separately - it is captured here deliberately so that the day
   * someone fixes it, this snapshot shows the change instead of the fix hiding
   * behind an already-wrong baseline. Do not "fix" the NaN by regenerating this
   * snapshot without also fixing the component.
   */
  it('renders an empty queue with no entries', () => {
    const { container } = render(
      <PayoutQueue
        data={{ cycleId: 1, totalMembers: 0, entries: [], currentUserAddress: undefined }}
      />
    );
    expect(container).toMatchSnapshot();
  });
});

describe('TransactionTables snapshots', () => {
  const transactions: Transaction[] = [
    {
      id: 't1',
      hash: 'tx1',
      createdAt: '2026-06-10T12:00:00Z',
      type: 'deposit',
      amount: '1500.25',
      assetCode: 'XLM',
      from: 'GAX7BQJ2N3V5YRQ4Z8W6KTPY1M3N9QRS7T2V4X6Z8A0B2C4D6E8F',
      status: 'success',
      fee: '0.00001',
    },
    {
      id: 't2',
      hash: 'tx2',
      createdAt: '2026-06-08T12:00:00Z',
      type: 'payment',
      amount: '-320.10',
      assetCode: 'USDC',
      from: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      status: 'success',
      fee: '0.00001',
    },
    {
      id: 't3',
      hash: 'tx3',
      createdAt: '2026-06-05T12:00:00Z',
      type: 'withdraw',
      amount: '-99',
      assetCode: 'XLM',
      from: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      status: 'failed',
      fee: '0.00001',
    },
  ];

  it('renders a populated transaction list', () => {
    render(<TransactionTables transactions={transactions} isLoading={false} onRowClick={() => {}} />);
    // Date column uses a bare toLocaleDateString() with no locale argument (a
    // latent flakiness bug noted above), so only the deterministic financial
    // fields are asserted here.
    expect(screen.getByText('1500.25 XLM')).toBeInTheDocument();
    expect(screen.getByText('-320.10 USDC')).toBeInTheDocument();
    expect(screen.getByText('-99 XLM')).toBeInTheDocument();
    expect(screen.getAllByText('success')).toHaveLength(2);
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    const { container } = render(
      <TransactionTables transactions={[]} isLoading onRowClick={() => {}} />
    );
    expect(container).toMatchSnapshot();
  });

  it('renders the empty state', () => {
    const { container } = render(
      <TransactionTables transactions={[]} isLoading={false} onRowClick={() => {}} />
    );
    expect(container).toMatchSnapshot();
  });
});

describe('dashboard TransactionTable snapshots', () => {
  const transactions: DashboardTransaction[] = [
    {
      id: 'd1',
      type: 'deposit',
      amount: 2500,
      currency: 'XLM',
      date: '2026-06-12',
      status: 'paid',
    },
    {
      id: 'd2',
      type: 'payout',
      amount: 750.5,
      currency: 'XLM',
      date: '2026-06-06',
      status: 'paid',
    },
    {
      id: 'd3',
      type: 'fee',
      amount: 0.5,
      currency: 'XLM',
      date: '2026-06-06',
      status: 'pending',
    },
  ];

  it('renders recent transactions with signed amounts and status chips', () => {
    render(<DashboardTransactionTable transactions={transactions} />);
    expect(screen.getByText('-2,500 XLM')).toBeInTheDocument();
    expect(screen.getByText('+750.5 XLM')).toBeInTheDocument();
    expect(screen.getByText('-0.5 XLM')).toBeInTheDocument();
    expect(screen.getAllByText('PAID')).toHaveLength(2);
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('renders the loading state', () => {
    const { container } = render(<DashboardTransactionTable transactions={[]} isLoading />);
    expect(container).toMatchSnapshot();
  });

  it('renders the empty state', () => {
    const { container } = render(<DashboardTransactionTable transactions={[]} />);
    expect(container).toMatchSnapshot();
  });
});
