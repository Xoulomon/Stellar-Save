import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { OverviewPanel } from '../components/panels/OverviewPanel';

import type { DetailedGroup, GroupContribution, GroupCycle } from '../utils/groupApi';

const mockGroup: DetailedGroup = {
  id: 'g1',
  name: 'Test Group',
  description: 'A test savings group',
  createdAt: new Date('2024-01-01'),
  totalMembers: 2,
  targetAmount: 2000,
  currentAmount: 1000,
  contributionFrequency: 'monthly',
  status: 'active',
  memberCount: 2,
  contributionAmount: 500,
  currency: 'XLM',
  cycleDuration: 30,
  members: [],
  contributions: [],
  cycles: [],
};

const mockContributions: GroupContribution[] = [];
const mockCycles: GroupCycle[] = [];

describe('OverviewPanel', () => {
  it('renders group name', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('A test savings group')).toBeInTheDocument();
  });

  it('displays member count', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays contribution frequency', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('monthly')).toBeInTheDocument();
  });

  it('calculates and displays progress percentage', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('50.0% Complete')).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(
      <OverviewPanel
        group={mockGroup}
        contributions={mockContributions}
        cycles={mockCycles}
      />,
    );
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
