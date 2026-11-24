import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GroupAnalyticsView } from './GroupAnalyticsView';

vi.mock('recharts', () => ({
  BarChart: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => (
    <div data-testid="bar-chart" data-count={data.length}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const cycleRates = [
  { cycleNumber: 1, contributorsInCycle: 3, totalMembersInCycle: 4, rate: 75 },
  { cycleNumber: 2, contributorsInCycle: 4, totalMembersInCycle: 4, rate: 100 },
];

const baseProps = {
  groupId: 'group-1',
  cycleRates,
  onTimePercent: 87.5,
  projectedCompletionDate: new Date('2027-01-15T00:00:00Z'),
  isLoading: false,
};

describe('GroupAnalyticsView', () => {
  it('renders computed metrics from props', () => {
    render(<GroupAnalyticsView {...baseProps} />);

    expect(screen.getByText('87.5%')).toBeInTheDocument();
    expect(screen.getByText(baseProps.projectedCompletionDate.toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-count', '2');
  });

  it('renders skeletons while loading', () => {
    const { container } = render(
      <GroupAnalyticsView
        {...baseProps}
        cycleRates={[]}
        onTimePercent={null}
        projectedCompletionDate={null}
        isLoading
      />
    );

    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('shows a fallback when no completion date is available', () => {
    render(
      <GroupAnalyticsView {...baseProps} projectedCompletionDate={null} onTimePercent={0} />
    );

    expect(screen.getByText('Not available')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders an empty chart when there are no completed cycles', () => {
    render(<GroupAnalyticsView {...baseProps} cycleRates={[]} />);

    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-count', '0');
  });
});
