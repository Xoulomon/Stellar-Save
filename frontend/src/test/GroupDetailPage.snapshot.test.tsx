/**
 * Snapshot tests for GroupDetailPage
 *
 * Captures rendering state to detect unintended UI regressions. Rewritten
 * to match GroupDetailPage's current data source: the shared useGroup()
 * React Query hook (queryKeys.groups.detail), not the page's old internal
 * mock-data generator. Mocks `utils/groupApi`'s real `fetchGroup` export
 * (the previous version of this file mocked a `fetchDetailedGroup` export
 * that was never part of groupApi.ts, so it never actually exercised the
 * page).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import GroupDetailPage from '../pages/GroupDetailPage';
import * as groupApi from '../utils/groupApi';

import type { DetailedGroup } from '../utils/groupApi';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../ui', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-card">{children}</div>
  ),
}));

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ activeAddress: 'GABC123XYZ' }),
}));

vi.mock('../routing/useNavigation', () => ({
  useNavigation: () => ({ params: { groupId: '123' } }),
}));

// Heavy subtrees mocked out — this suite verifies GroupDetailPage's own
// loading/error/data rendering via useGroup(), not these components'
// internals (each has its own test coverage elsewhere).
vi.mock('../components/ContributionFlow', () => ({
  ContributionFlow: () => <div data-testid="contribution-flow" />,
}));
vi.mock('../components/InsurancePanel', () => ({
  InsurancePanel: () => <div data-testid="insurance-panel" />,
}));
vi.mock('../components/GroupReportExportButton', () => ({
  GroupReportExportButton: () => <button type="button">Export report</button>,
}));

vi.mock('../utils/groupApi', async () => {
  const actual = await vi.importActual<typeof import('../utils/groupApi')>('../utils/groupApi');
  return { ...actual, fetchGroup: vi.fn() };
});

const mockFetchGroup = vi.mocked(groupApi.fetchGroup);

// Mock fixture data — shape matches DetailedGroup (the real return type of
// fetchGroup / useGroup()'s `group` field).
const mockGroupDetail: DetailedGroup = {
  id: '123',
  name: 'Alpha Savings Circle',
  description: 'Monthly savings pool for community members',
  status: 'active',
  memberCount: 5,
  contributionAmount: 100,
  currency: 'XLM',
  createdAt: new Date('2024-01-15'),
  totalMembers: 5,
  targetAmount: 500,
  currentAmount: 300,
  contributionFrequency: 'monthly',
  members: [
    {
      id: '1',
      address: 'GMEMBER1',
      joinedAt: new Date('2024-01-15'),
      totalContributions: 300,
      isActive: true,
    },
    {
      id: '2',
      address: 'GMEMBER2',
      joinedAt: new Date('2024-01-16'),
      totalContributions: 300,
      isActive: true,
    },
    {
      id: '3',
      address: 'GABC123XYZ',
      joinedAt: new Date('2024-01-18'),
      totalContributions: 200,
      isActive: true,
    },
  ],
  contributions: [
    {
      id: 'c1',
      memberId: '1',
      memberName: 'GMEMBER1',
      amount: 100,
      timestamp: new Date('2024-06-01'),
      transactionHash: 'tx1',
      status: 'completed',
    },
  ],
  cycles: [
    {
      cycleNumber: 1,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      targetAmount: 500,
      currentAmount: 500,
      status: 'completed',
    },
    {
      cycleNumber: 2,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-28'),
      targetAmount: 500,
      currentAmount: 300,
      status: 'active',
    },
  ],
  currentCycle: {
    cycleNumber: 2,
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-02-28'),
    targetAmount: 500,
    currentAmount: 300,
    status: 'active',
  },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GroupDetailPage />
    </QueryClientProvider>
  );
}

// ── Snapshot tests ────────────────────────────────────────────────────────────

describe('GroupDetailPage snapshot tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches snapshot with full group data', async () => {
    mockFetchGroup.mockResolvedValue(mockGroupDetail);
    const { container, findAllByText } = renderPage();

    // The group name renders both as the AppLayout page title and as the
    // in-content heading, so there are two matching elements.
    await findAllByText('Alpha Savings Circle');
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with loading state', () => {
    mockFetchGroup.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with error state', async () => {
    mockFetchGroup.mockRejectedValue(new Error('Group not found'));
    const { container, findByText } = renderPage();

    await findByText(/error/i, {}, { timeout: 3000 }).catch(() => {});
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with completed group', async () => {
    const completedGroup: DetailedGroup = {
      ...mockGroupDetail,
      status: 'completed',
      members: mockGroupDetail.members.map((m) => ({ ...m, isActive: false })),
    };
    mockFetchGroup.mockResolvedValue(completedGroup);

    const { container, findAllByText } = renderPage();

    await findAllByText('Alpha Savings Circle');
    expect(container).toMatchSnapshot();
  });
});
