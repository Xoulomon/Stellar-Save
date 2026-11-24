import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GroupAnalytics from '../pages/GroupAnalytics';

const { mockUseGroupAnalytics } = vi.hoisted(() => ({ mockUseGroupAnalytics: vi.fn() }));

vi.mock('../ui', () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div data-testid="app-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
}));

vi.mock('../components/ErrorState', () => ({
  ErrorState: ({ message }: { message: string }) => <div data-testid="error-state">{message}</div>,
}));

vi.mock('../hooks/useGroupAnalytics', () => ({
  useGroupAnalytics: () => mockUseGroupAnalytics(),
}));

vi.mock('../pages/group-analytics', () => ({
  GroupAnalyticsView: (props: { groupId?: string; isLoading: boolean; cycleRates: unknown[] }) => (
    <div
      data-testid="analytics-view"
      data-group={props.groupId}
      data-loading={props.isLoading}
      data-count={props.cycleRates.length}
    />
  ),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/groups/group-1/analytics']}>
      <Routes>
        <Route path="/groups/:groupId/analytics" element={<GroupAnalytics />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GroupAnalytics container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGroupAnalytics.mockReturnValue({
      cycleRates: [{ cycleNumber: 1, contributorsInCycle: 2, totalMembersInCycle: 4, rate: 50 }],
      onTimePercent: 50,
      projectedCompletionDate: new Date('2027-01-15T00:00:00Z'),
      isLoading: false,
      error: null,
    });
  });

  it('passes the route groupId and analytics data to the view', () => {
    renderPage();

    expect(screen.getByTestId('analytics-view')).toHaveAttribute('data-group', 'group-1');
    expect(screen.getByTestId('analytics-view')).toHaveAttribute('data-count', '1');
  });

  it('renders an error state instead of the view when loading fails', () => {
    mockUseGroupAnalytics.mockReturnValue({
      cycleRates: [],
      onTimePercent: null,
      projectedCompletionDate: null,
      isLoading: false,
      error: 'network down',
    });

    renderPage();

    expect(screen.getByTestId('error-state')).toHaveTextContent('network down');
    expect(screen.queryByTestId('analytics-view')).not.toBeInTheDocument();
  });
});
