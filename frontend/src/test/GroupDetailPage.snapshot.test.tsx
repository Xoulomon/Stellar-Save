/**
 * Snapshot tests for GroupDetailPage
 *
 * Captures rendering state to detect unintended UI regressions
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GroupDetailPage from '../pages/GroupDetailPage';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../ui', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => <div data-testid="app-card">{children}</div>,
}));

vi.mock('../hooks/useWallet', () => ({
  useWallet: () => ({ address: 'GABC123XYZ', isConnected: true }),
}));

vi.mock('../routing/useNavigation', () => ({
  useNavigation: () => ({ navigateTo: vi.fn() }),
}));

// Mock fixture data
const mockGroupDetail = {
  id: '123',
  name: 'Alpha Savings Circle',
  description: 'Monthly savings pool for community members',
  status: 'active',
  contributionAmount: 100,
  currency: 'XLM',
  cycleNumber: 3,
  cycleDuration: 604800,
  maxMembers: 10,
  memberCount: 7,
  createdAt: new Date('2024-01-15'),
  creator: 'GCREATOR123',
  members: [
    { address: 'GMEMBER1', joinedAt: new Date('2024-01-15'), payoutPosition: 1, hasReceivedPayout: true },
    { address: 'GMEMBER2', joinedAt: new Date('2024-01-16'), payoutPosition: 2, hasReceivedPayout: true },
    { address: 'GMEMBER3', joinedAt: new Date('2024-01-17'), payoutPosition: 3, hasReceivedPayout: true },
    { address: 'GABC123XYZ', joinedAt: new Date('2024-01-18'), payoutPosition: 4, hasReceivedPayout: false },
    { address: 'GMEMBER5', joinedAt: new Date('2024-01-19'), payoutPosition: 5, hasReceivedPayout: false },
  ],
  contributions: [
    { memberId: 'GMEMBER1', cycle: 3, amount: 100, timestamp: new Date('2024-06-01') },
    { memberId: 'GMEMBER2', cycle: 3, amount: 100, timestamp: new Date('2024-06-01') },
    { memberId: 'GABC123XYZ', cycle: 3, amount: 100, timestamp: new Date('2024-06-02') },
  ],
  payouts: [
    { cycle: 1, recipient: 'GMEMBER1', amount: 700, timestamp: new Date('2024-03-01') },
    { cycle: 2, recipient: 'GMEMBER2', amount: 700, timestamp: new Date('2024-04-01') },
  ],
};

vi.mock('../utils/groupApi', () => ({
  fetchDetailedGroup: vi.fn().mockResolvedValue(mockGroupDetail),
}));

// ── Snapshot tests ────────────────────────────────────────────────────────────

describe('GroupDetailPage snapshot tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches snapshot with full group data', async () => {
    const { container, findByText } = render(
      <MemoryRouter initialEntries={['/groups/123']}>
        <Routes>
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for async data to load
    await findByText('Alpha Savings Circle');
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with loading state', () => {
    vi.mock('../utils/groupApi', () => ({
      fetchDetailedGroup: vi.fn().mockReturnValue(new Promise(() => {})),
    }));

    const { container } = render(
      <MemoryRouter initialEntries={['/groups/123']}>
        <Routes>
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with error state', async () => {
    vi.mock('../utils/groupApi', () => ({
      fetchDetailedGroup: vi.fn().mockRejectedValue(new Error('Group not found')),
    }));

    const { container, findByText } = render(
      <MemoryRouter initialEntries={['/groups/123']}>
        <Routes>
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await findByText(/error/i, {}, { timeout: 3000 }).catch(() => {});
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with completed group', async () => {
    const completedGroup = {
      ...mockGroupDetail,
      status: 'completed',
      members: mockGroupDetail.members.map(m => ({ ...m, hasReceivedPayout: true })),
    };

    vi.mock('../utils/groupApi', () => ({
      fetchDetailedGroup: vi.fn().mockResolvedValue(completedGroup),
    }));

    const { container, findByText } = render(
      <MemoryRouter initialEntries={['/groups/123']}>
        <Routes>
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await findByText('Alpha Savings Circle');
    expect(container).toMatchSnapshot();
  });
});
