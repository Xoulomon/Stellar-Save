export interface GroupTemplate {
  id: number;
  name: string;
  description: string;
  cycleDuration: number; // days
  maxMembers: number;
  totalDuration: string;
  category: 'short' | 'medium' | 'long';
}

export const GROUP_TEMPLATES: GroupTemplate[] = [
  {
    id: 1,
    name: 'Weekly Saver',
    description: 'Frequent payouts for tight-knit groups with short commitment windows.',
    cycleDuration: 7,
    maxMembers: 10,
    totalDuration: '~10 weeks',
    category: 'short',
  },
  {
    id: 2,
    name: 'Biweekly Saver',
    description: 'A middle ground with slightly larger pools and manageable cadence.',
    cycleDuration: 14,
    maxMembers: 8,
    totalDuration: '~16 weeks',
    category: 'short',
  },
  {
    id: 3,
    name: 'Monthly Pool',
    description: 'The most common Ajo/Esusu pattern — 12 members, one payout per month.',
    cycleDuration: 30,
    maxMembers: 12,
    totalDuration: '~12 months',
    category: 'medium',
  },
  {
    id: 4,
    name: 'Quarterly Circle',
    description: 'Larger contribution amounts with less frequent cycles.',
    cycleDuration: 90,
    maxMembers: 4,
    totalDuration: '~12 months',
    category: 'medium',
  },
  {
    id: 5,
    name: 'Annual Pool',
    description: 'Long-term savings commitment ideal for capital accumulation.',
    cycleDuration: 365,
    maxMembers: 5,
    totalDuration: '~5 years',
    category: 'long',
  },
];
