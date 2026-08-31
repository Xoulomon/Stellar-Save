import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ContributionsPanel } from '../components/panels/ContributionsPanel';

import type { GroupContribution } from '../utils/groupApi';

const mockContributions: GroupContribution[] = [
  {
    id: 'c1',
    memberId: 'm1',
    memberName: 'Alice',
    amount: 500,
    timestamp: new Date('2024-02-01'),
    transactionHash: '0xabc',
    status: 'completed',
  },
  {
    id: 'c2',
    memberId: 'm2',
    memberName: 'Bob',
    amount: 300,
    timestamp: new Date('2024-02-02'),
    transactionHash: '0xdef',
    status: 'pending',
  },
];

describe('ContributionsPanel', () => {
  it('renders contribution count', () => {
    render(<ContributionsPanel contributions={mockContributions} />);
    expect(screen.getByText('Contribution History (2)')).toBeInTheDocument();
  });

  it('renders all member names in contributions', () => {
    render(<ContributionsPanel contributions={mockContributions} />);
    expect(screen.getAllByText('Alice')).length;
    expect(screen.getAllByText('Bob')).length;
  });

  it('displays completed badge for completed contributions', () => {
    render(<ContributionsPanel contributions={mockContributions} />);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('displays pending badge for pending contributions', () => {
    render(<ContributionsPanel contributions={mockContributions} />);
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('calls onContributionClick when contribution is clicked', () => {
    const onContributionClick = vi.fn();
    render(
      <ContributionsPanel
        contributions={mockContributions}
        onContributionClick={onContributionClick}
      />,
    );
    const firstContribution = screen.getAllByText('Alice')[0];
    fireEvent.click(firstContribution.closest('.group-details-contribution-item')!);
    expect(onContributionClick).toHaveBeenCalledWith(mockContributions[0]);
  });

  it('renders empty when no contributions', () => {
    render(<ContributionsPanel contributions={[]} />);
    expect(screen.getByText('Contribution History (0)')).toBeInTheDocument();
  });
});
