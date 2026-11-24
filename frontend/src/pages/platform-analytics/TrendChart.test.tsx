import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TrendChart } from './TrendChart';

const data = [
  {
    date: '2026-01-01',
    totalUsers: 10,
    activeUsers: 6,
    totalGroups: 2,
    activeGroups: 1,
    totalContributions: 8,
    totalContributionAmount: 80,
    totalPayouts: 3,
    totalPayoutAmount: 30,
    successRate: 0.9,
  },
];

describe('TrendChart', () => {
  it('renders the selected trend and its data point', () => {
    render(<TrendChart data={data} field="activeUsers" label="Daily Active Users" color="blue" />);

    expect(screen.getByText('Daily Active Users')).toBeInTheDocument();
    expect(screen.getByLabelText('Daily Active Users trend')).toBeInTheDocument();
    expect(screen.getByTitle('2026-01-01: 6')).toBeInTheDocument();
  });

  it('renders nothing when no trend points are available', () => {
    const { container } = render(
      <TrendChart data={[]} field="activeUsers" label="Daily Active Users" color="blue" />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
