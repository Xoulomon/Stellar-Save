/**
 * Snapshot tests for DashboardPage
 *
 * Captures rendering state to detect unintended UI regressions
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';

// ── Mock dependencies ─────────────────────────────────────────────────────────

vi.mock('../ui', () => ({
  AppLayout: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
  AppCard: ({ children }: { children: React.ReactNode }) => <div data-testid="app-card">{children}</div>,
}));

vi.mock('../components/ErrorBoundary/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/Toast/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock fixture data
const mockStats = {
  totalGroups: 12,
  activeGroups: 8,
  totalContributions: 45000,
  totalPayouts: 28000,
};

const mockGroups = [
  { id: '1', name: 'Alpha Circle', status: 'active', memberCount: 5, contributionAmount: 100, currency: 'XLM', cycleNumber: 2, createdAt: new Date('2024-01-15') },
  { id: '2', name: 'Beta Pool', status: 'active', memberCount: 8, contributionAmount: 250, currency: 'USDC', cycleNumber: 1, createdAt: new Date('2024-02-01') },
];

const mockPayouts = [
  { groupId: '1', groupName: 'Alpha Circle', recipientAddress: 'GABC...XYZ', amount: 500, dueDate: new Date('2024-06-15') },
  { groupId: '2', groupName: 'Beta Pool', recipientAddress: 'GDEF...ABC', amount: 2000, dueDate: new Date('2024-06-20') },
];

const mockTransactions = [
  { id: 'tx1', type: 'contribution', groupName: 'Alpha Circle', amount: 100, timestamp: new Date('2024-06-01'), status: 'confirmed' },
  { id: 'tx2', type: 'payout', groupName: 'Beta Pool', amount: 2000, timestamp: new Date('2024-05-28'), status: 'confirmed' },
];

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: () => ({
    stats: mockStats,
    groups: mockGroups,
    payouts: mockPayouts,
    transactions: mockTransactions,
    isLoading: false,
  }),
}));

vi.mock('../hooks/useBalanceWarning', () => ({
  useBalanceWarning: () => null,
}));

// ── Snapshot tests ────────────────────────────────────────────────────────────

describe('DashboardPage snapshot tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches snapshot with loaded data', () => {
    const { container } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with loading state', () => {
    vi.mock('../hooks/useDashboard', () => ({
      useDashboard: () => ({
        stats: null,
        groups: [],
        payouts: [],
        transactions: [],
        isLoading: true,
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('matches snapshot with empty state', () => {
    vi.mock('../hooks/useDashboard', () => ({
      useDashboard: () => ({
        stats: { totalGroups: 0, activeGroups: 0, totalContributions: 0, totalPayouts: 0 },
        groups: [],
        payouts: [],
        transactions: [],
        isLoading: false,
      }),
    }));

    const { container } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });
});
