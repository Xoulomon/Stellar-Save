# GroupDetails Component

A comprehensive component for displaying detailed group information in the Stellar Save application.

## Features

- **Group Overview**: Display all group information including status, members, and description
- **Progress Tracking**: Visual progress bars showing current vs target amounts
- **Cycle Information**: Current cycle details and historical cycle data
- **Member List**: Display all group members with their contribution totals and status
- **Contribution History**: Complete list of all contributions with timestamps and status

## Usage

```tsx
import { GroupDetails } from './components';
import type { GroupInfo, GroupMember, Contribution, CycleInfo } from './components';

const group: GroupInfo = {
  id: '1',
  name: 'Monthly Savings Group',
  description: 'A group focused on building emergency funds',
  createdAt: new Date('2024-01-01'),
  totalMembers: 5,
  targetAmount: 10000,
  currentAmount: 7500,
  contributionFrequency: 'monthly',
  status: 'active',
};

const members: GroupMember[] = [
  {
    id: '1',
    address: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    name: 'Alice',
    joinedAt: new Date('2024-01-01'),
    totalContributions: 2000,
    isActive: true,
  },
  // ... more members
];

const contributions: Contribution[] = [
  {
    id: '1',
    memberId: '1',
    memberName: 'Alice',
    amount: 500,
    timestamp: new Date('2024-02-01'),
    transactionHash: '0x123...',
    status: 'completed',
  },
  // ... more contributions
];

const cycles: CycleInfo[] = [
  {
    cycleNumber: 1,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    targetAmount: 2500,
    currentAmount: 2500,
    status: 'completed',
  },
  // ... more cycles
];

const currentCycle: CycleInfo = {
  cycleNumber: 3,
  startDate: new Date('2024-03-01'),
  endDate: new Date('2024-03-31'),
  targetAmount: 2500,
  currentAmount: 1500,
  status: 'active',
};

function MyComponent() {
  const handleMemberClick = (member: GroupMember) => {
    console.log('Member clicked:', member);
  };

  const handleContributionClick = (contribution: Contribution) => {
    console.log('Contribution clicked:', contribution);
  };

  return (
    <GroupDetails
      group={group}
      members={members}
      contributions={contributions}
      cycles={cycles}
      currentCycle={currentCycle}
      onMemberClick={handleMemberClick}
      onContributionClick={handleContributionClick}
    />
  );
}
```

## Props

### GroupDetailsProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `group` | `GroupInfo` | Yes | Main group information |
| `members` | `GroupMember[]` | Yes | Array of group members |
| `contributions` | `Contribution[]` | Yes | Array of contributions |
| `cycles` | `CycleInfo[]` | Yes | Array of cycle history |
| `currentCycle` | `CycleInfo` | No | Current active cycle |
| `onMemberClick` | `(member: GroupMember) => void` | No | Callback when member is clicked |
| `onContributionClick` | `(contribution: Contribution) => void` | No | Callback when contribution is clicked |
| `className` | `string` | No | Additional CSS classes |

## Type Definitions

### GroupInfo

```typescript
interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  totalMembers: number;
  targetAmount: number;
  currentAmount: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'completed';
}
```

### GroupMember

```typescript
interface GroupMember {
  id: string;
  address: string;
  name?: string;
  joinedAt: Date;
  totalContributions: number;
  isActive: boolean;
}
```

### Contribution

```typescript
interface Contribution {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  timestamp: Date;
  transactionHash: string;
  status: 'completed' | 'pending' | 'failed';
}
```

### CycleInfo

```typescript
interface CycleInfo {
  cycleNumber: number;
  startDate: Date;
  endDate: Date;
  targetAmount: number;
  currentAmount: number;
  status: 'active' | 'completed' | 'upcoming';
}
```

## Tabs

The component includes four tabs:

1. **Overview** (📊): Group information, description, and overall progress
2. **Cycles** (🔄): Current cycle status and historical cycle data
3. **Members** (👥): List of all group members with their stats
4. **Contributions** (💰): Complete contribution history

## Styling

The component uses CSS modules and follows the existing design system:
- Dark mode by default with light mode support
- Responsive design for mobile, tablet, and desktop
- Hover effects on interactive elements
- Consistent spacing and typography

## Accessibility

- Semantic HTML structure
- Proper ARIA labels
- Keyboard navigation support through Tabs component
- Color contrast compliance

## Dependencies

- `Card` component for layout
- `Badge` component for status indicators
- `Avatar` component for member display
- `Tabs` component for navigation
