import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import DashboardPage from '../pages/DashboardPage';

const { mockUseDashboardData, mockUseBalanceWarning } = vi.hoisted(() => ({
  mockUseDashboardData: vi.fn(),
  mockUseBalanceWarning: vi.fn(),
}));

vi.mock('../ui', () => ({
  AppLayout: ({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
}));

vi.mock('../components/ErrorBoundary/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/Toast/ToastProvider', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../hooks/useDashboardData', () => ({
  useDashboardData: () => mockUseDashboardData(),
}));

vi.mock('../hooks/useBalanceWarning', () => ({
  useBalanceWarning: () => mockUseBalanceWarning(),
}));

vi.mock('../pages/dashboard', () => ({
  DashboardView: (props: { groups: unknown[]; isLoading: boolean; balanceWarning: unknown }) => (
    <div
      data-testid="dashboard-view"
      data-loading={props.isLoading}
      data-count={props.groups.length}
      data-warning={JSON.stringify(props.balanceWarning)}
    />
  ),
}));

const stats = {
  totalBalance: 12450,
  nextPayoutAmount: 5000,
  nextPayoutDate: 'May 15, 2026',
  currency: 'XLM',
};

const groups = [
  {
    id: '1',
    name: 'Alpha Circle',
    currentCycle: 4,
    totalCycles: 10,
    contributionAmount: 500,
    currency: 'XLM',
    status: 'active' as const,
  },
];

const balanceWarning = {
  isInsufficient: false,
  currentBalance: 100,
  requiredAmount: 50,
  shortfall: 0,
};

describe('DashboardPage container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDashboardData.mockReturnValue({
      stats,
      groups,
      payouts: [],
      transactions: [],
      isLoading: false,
    });
    mockUseBalanceWarning.mockReturnValue(balanceWarning);
  });

  it('renders the page shell and passes loaded data to the view', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('app-layout')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('dashboard-view')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('dashboard-view')).toHaveAttribute('data-loading', 'false');
    expect(mockUseBalanceWarning).toHaveBeenCalled();
  });

  it('passes the loading state through to the view', () => {
    mockUseDashboardData.mockReturnValue({
      stats: null,
      groups: [],
      payouts: [],
      transactions: [],
      isLoading: true,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-view')).toHaveAttribute('data-loading', 'true');
  });

  it('forwards the balance warning derived from the groups', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('dashboard-view')).toHaveAttribute(
      'data-warning',
      JSON.stringify(balanceWarning)
    );
  });
});
