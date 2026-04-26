import { useEffect, useState } from 'react';
import type { ContributionTimelineEvent } from '../components/MemberContributionTimeline';

const mockMemberContributionHistory: ContributionTimelineEvent[] = [
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
    type: 'contribution',
    timestamp: new Date('2026-03-21T14:15:00Z'),
    amount: 250,
    description: 'March group contribution',
    transactionHash: 'def456ghi789',
    status: 'completed',
  },
  {
    id: 'evt-3',
    groupId: 'g1',
    groupName: 'Weekly Savers',
    type: 'payout',
    timestamp: new Date('2026-04-01T09:30:00Z'),
    amount: 900,
    description: 'Payout after cycle completion',
    transactionHash: 'ghi789jkl012',
    status: 'completed',
  },
  {
    id: 'evt-4',
    groupId: 'g3',
    groupName: 'Student Circle',
    type: 'contribution',
    timestamp: new Date('2026-04-05T12:00:00Z'),
    amount: 60,
    description: 'Biweekly contribution for dorm fund',
    transactionHash: 'jkl012mno345',
    status: 'pending',
  },
  {
    id: 'evt-5',
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

export const useMemberContributionHistory = () => {
  const [events, setEvents] = useState<ContributionTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEvents(mockMemberContributionHistory);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return { events, isLoading };
};
