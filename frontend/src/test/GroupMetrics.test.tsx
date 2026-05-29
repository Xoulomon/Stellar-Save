import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupMetrics } from '../components/GroupMetrics';
import type { DetailedGroup, GroupContribution, GroupCycle } from '../utils/groupApi';

function buildGroup(contributions: GroupContribution[], cycles: GroupCycle[]): DetailedGroup {
  return {
    id: 'g1',
    name: 'Performance Group',
    description: 'Metrics test group',
    memberCount: 4,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    totalMembers: 4,
    targetAmount: 1000,
    currentAmount: 650,
    contributionFrequency: 'weekly',
    members: [],
    contributions,
    cycles,
    currentCycle: cycles[cycles.length - 1],
  };
}

describe('GroupMetrics', () => {
  it('renders required metrics labels', () => {
    const contributions: GroupContribution[] = [];
    const cycles: GroupCycle[] = [];

    render(
      <GroupMetrics
        group={buildGroup(contributions, cycles)}
        contributions={contributions}
        cycles={cycles}
      />
    );

    expect(screen.getByText('Contribution Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('Average Contribution Time')).toBeInTheDocument();
    expect(screen.getByText('Group Health Score')).toBeInTheDocument();
  });

  it('calculates completion rate, average contribution time, and health score', () => {
    const contributions: GroupContribution[] = [
      {
        id: 'c1',
        memberId: 'm1',
        amount: 100,
        timestamp: new Date('2026-01-01T00:00:00Z'),
        transactionHash: 'tx1',
        status: 'completed',
      },
      {
        id: 'c2',
        memberId: 'm2',
        amount: 100,
        timestamp: new Date('2026-01-03T00:00:00Z'),
        transactionHash: 'tx2',
        status: 'completed',
      },
      {
        id: 'c3',
        memberId: 'm3',
        amount: 100,
        timestamp: new Date('2026-01-06T00:00:00Z'),
        transactionHash: 'tx3',
        status: 'completed',
      },
      {
        id: 'c4',
        memberId: 'm4',
        amount: 100,
        timestamp: new Date('2026-01-07T00:00:00Z'),
        transactionHash: 'tx4',
        status: 'pending',
      },
    ];

    const cycles: GroupCycle[] = [
      {
        cycleNumber: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T00:00:00Z'),
        targetAmount: 1000,
        currentAmount: 400,
        status: 'completed',
      },
      {
        cycleNumber: 2,
        startDate: new Date('2026-02-01T00:00:00Z'),
        endDate: new Date('2026-02-28T00:00:00Z'),
        targetAmount: 1000,
        currentAmount: 800,
        status: 'active',
      },
    ];

    render(
      <GroupMetrics
        group={buildGroup(contributions, cycles)}
        contributions={contributions}
        cycles={cycles}
      />
    );

    expect(screen.getByTestId('completion-rate-value')).toHaveTextContent('75%');
    expect(screen.getByTestId('average-time-value')).toHaveTextContent('2.5 days');
    expect(screen.getByTestId('health-score-value')).toHaveTextContent('73/100');
    expect(screen.getAllByText('Improving').length).toBeGreaterThan(0);
  });

  it('shows declining trend indicators when performance drops', () => {
    const contributions: GroupContribution[] = [
      {
        id: 'c1',
        memberId: 'm1',
        amount: 100,
        timestamp: new Date('2026-01-08T00:00:00Z'),
        transactionHash: 'tx1',
        status: 'completed',
      },
      {
        id: 'c2',
        memberId: 'm2',
        amount: 100,
        timestamp: new Date('2026-01-09T00:00:00Z'),
        transactionHash: 'tx2',
        status: 'completed',
      },
      {
        id: 'c3',
        memberId: 'm3',
        amount: 100,
        timestamp: new Date('2026-01-10T00:00:00Z'),
        transactionHash: 'tx3',
        status: 'completed',
      },
      {
        id: 'c4',
        memberId: 'm4',
        amount: 100,
        timestamp: new Date('2026-01-20T00:00:00Z'),
        transactionHash: 'tx4',
        status: 'completed',
      },
    ];

    const cycles: GroupCycle[] = [
      {
        cycleNumber: 1,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T00:00:00Z'),
        targetAmount: 1000,
        currentAmount: 900,
        status: 'completed',
      },
      {
        cycleNumber: 2,
        startDate: new Date('2026-02-01T00:00:00Z'),
        endDate: new Date('2026-02-28T00:00:00Z'),
        targetAmount: 1000,
        currentAmount: 600,
        status: 'active',
      },
    ];

    render(
      <GroupMetrics
        group={buildGroup(contributions, cycles)}
        contributions={contributions}
        cycles={cycles}
      />
    );

    expect(screen.getAllByText('Declining').length).toBeGreaterThan(0);
  });
});
