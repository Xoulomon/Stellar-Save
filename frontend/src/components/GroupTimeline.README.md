# GroupTimeline Component

The `GroupTimeline` component displays a chronological timeline of group activities including contributions, payouts, and member joins.

## Features

- ✅ **Scrollable Timeline**: Displays activities in a scrollable container with customizable height
- ✅ **Multiple Event Types**: Supports contributions, payouts, and member joins
- ✅ **Rich Timestamps**: Shows relative time (e.g., "2h ago") with full date/time on hover
- ✅ **Status Indicators**: Displays pending/failed status badges for transactions
- ✅ **Color-Coded Events**: Each event type has a distinct color for quick recognition
- ✅ **Responsive Design**: Works seamlessly on mobile, tablet, and desktop devices
- ✅ **Accessibility**: Keyboard navigation and proper ARIA roles
- ✅ **Transaction Links**: Shows transaction hashes for on-chain verification

## Usage

### Basic Example

```tsx
import { GroupTimeline, TimelineEvent } from '@/components';

function GroupDetailsPage() {
  const events: TimelineEvent[] = [
    {
      id: '1',
      type: 'contribution',
      memberAddress: 'GB7NRG3R4YSRZ3YNZWHTMLJHKDCTXZ...',
      memberName: 'Alice',
      timestamp: new Date(),
      amount: 100,
      status: 'completed',
    },
    {
      id: '2',
      type: 'member_join',
      memberAddress: 'GBYX7KQKL3QYXQ7IYZH...',
      memberName: 'Bob',
      timestamp: new Date(Date.now() - 3600000),
    },
    {
      id: '3',
      type: 'payout',
      memberAddress: 'GAXJNZ3QZKHQTZ...',
      memberName: 'Charlie',
      timestamp: new Date(Date.now() - 7200000),
      amount: 500,
      transactionHash: 'abc123def456...',
      status: 'completed',
    },
  ];

  const handleEventClick = (event: TimelineEvent) => {
    console.log('Event clicked:', event);
    if (event.transactionHash) {
      // Navigate to transaction details
    }
  };

  return (
    <GroupTimeline
      events={events}
      maxHeight="600px"
      onEventClick={handleEventClick}
    />
  );
}
```

## Props

### `GroupTimelineProps`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `events` | `TimelineEvent[]` | Required | Array of timeline events to display |
| `maxHeight` | `string` | `'600px'` | Maximum height of the scrollable container |
| `onEventClick` | `(event: TimelineEvent) => void` | - | Optional callback when an event is clicked |
| `emptyStateMessage` | `string` | `'No activity yet'` | Message shown when no events exist |
| `className` | `string` | `''` | Additional CSS classes to apply |

## Types

### `TimelineEvent`

```typescript
interface TimelineEvent {
  id: string;                              // Unique event identifier
  type: 'contribution' | 'payout' | 'member_join';
  memberAddress: string;                   // Member's Stellar address
  memberName?: string;                     // Optional display name
  timestamp: Date;                         // When the event occurred
  amount?: number;                         // Amount in stroops (for contributions/payouts)
  description?: string;                    // Optional additional details
  transactionHash?: string;                // Stellar transaction hash
  status?: 'completed' | 'pending' | 'failed'; // Transaction status
}
```

### `TimelineEventType`

```typescript
type TimelineEventType = 'contribution' | 'payout' | 'member_join';
```

## Event Colors and Icons

- **Contribution** (Green): TrendingUp icon - when a member contributes funds
- **Payout** (Yellow): CreditCard icon - when a member receives a payout
- **Member Join** (Blue): PersonAdd icon - when a new member joins the group

## Styling

The component uses CSS custom properties and Material Design colors. You can customize the appearance by overriding CSS classes:

- `.group-timeline` - Main container
- `.timeline-item-contribution` - Contribution events
- `.timeline-item-payout` - Payout events
- `.timeline-item-member-join` - Member join events

### Custom Styling Example

```css
/* Override scrollbar color */
.timeline-container::-webkit-scrollbar-thumb {
  background: rgba(76, 175, 80, 0.5);
}

/* Customize timeline dot size */
.timeline-item-dot {
  width: 50px;
  height: 50px;
}
```

## Accessibility

- Keyboard navigation: Press Tab to focus, Enter/Space to activate clicked callback
- Screen reader support: ARIA roles and semantic HTML
- Color not the only indicator: Icons and text labels differentiate event types

## Performance

- Events sorted by timestamp (newest first) using `useMemo`
- Scrollable container prevents layout thrashing
- Efficient re-renders with proper key management

## Example with Mock Data

See `GroupTimeline.example.tsx` for a complete working example with various event types and mock data.

## Related Components

- `GroupDetails` - Shows group information, members, and cycle details
- `MemberList` - Displays group members
- `CycleProgress` - Shows current cycle progress

