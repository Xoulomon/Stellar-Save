import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemberContributionTimeline, type ContributionTimelineEvent } from '../components/MemberContributionTimeline';

const events: ContributionTimelineEvent[] = [
  {
    id: 'evt-1',
    groupId: 'g1',
    groupName: 'Weekly Savers',
    type: 'contribution',
    timestamp: new Date('2026-03-16T10:00:00Z'),
    amount: 100,
    description: 'Weekly contribution to the common pool',
    transactionHash: 'abc123def456',
    status: 'completed',
  },
  {
    id: 'evt-2',
    groupId: 'g2',
    groupName: 'Monthly Builders',
    type: 'payout',
    timestamp: new Date('2026-04-10T16:45:00Z'),
    amount: 1200,
    description: 'Group payout distribution',
    transactionHash: 'mno345pqr678',
    status: 'completed',
  },
];

describe('MemberContributionTimeline', () => {
  it('renders timeline controls and cards', () => {
    render(<MemberContributionTimeline events={events} />);

    expect(screen.getByText('Contribution Timeline')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /group/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Weekly Savers' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Monthly Builders' })).toBeInTheDocument();
    expect(screen.getByText('Contribution')).toBeInTheDocument();
    expect(screen.getByText('Payout')).toBeInTheDocument();
  });

  it('filters by selected group', async () => {
    const user = userEvent.setup();
    render(<MemberContributionTimeline events={events} />);

    const groupSelect = screen.getByRole('combobox', { name: /group/i });
    await user.selectOptions(groupSelect, 'g1');

    const selectedOption = screen.getByRole('option', { name: 'Weekly Savers' }) as HTMLOptionElement;
    expect(selectedOption).toBeInTheDocument();
    expect(selectedOption.selected).toBe(true);
    expect(screen.queryByText('Group payout distribution')).not.toBeInTheDocument();
  });

  it('calls onEventClick when a card is clicked', async () => {
    const user = userEvent.setup();
    const onEventClick = vi.fn();

    render(<MemberContributionTimeline events={events} onEventClick={onEventClick} />);

    await user.click(screen.getByRole('button', { name: /contribution/i }));
    expect(onEventClick).toHaveBeenCalledTimes(1);
  });

  it('updates zoom level when clicking zoom controls', async () => {
    const user = userEvent.setup();
    render(<MemberContributionTimeline events={events} />);

    const zoomIn = screen.getByRole('button', { name: /zoom in/i });
    const zoomOut = screen.getByRole('button', { name: /zoom out/i });

    await user.click(zoomOut);
    expect(screen.getByText(/compact/i)).toBeInTheDocument();

    await user.click(zoomIn);
    expect(screen.getByText(/cozy/i)).toBeInTheDocument();
  });
});
