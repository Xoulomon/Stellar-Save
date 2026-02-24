# MemberList Component

## Overview
The MemberList component displays a sortable list of group members with their contribution and payout status.

## Features
- ✅ Display member addresses with avatars
- ✅ Show contribution status (contributed or not)
- ✅ Show payout status (paid out or not)
- ✅ Sortable by address, contribution status, or payout status
- ✅ Responsive design for mobile and desktop
- ✅ Empty state when no members

## Usage

```tsx
import { MemberList, Member } from './components';

const members: Member[] = [
  {
    address: 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZA567BCD890',
    hasContributed: true,
    hasPaidOut: false,
  },
  {
    address: 'GXYZ987WVU654TSR321PON098MLK765JIH432GFE109DCB876AZY543XWV210',
    hasContributed: false,
    hasPaidOut: true,
  },
];

function MyComponent() {
  return <MemberList members={members} />;
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `members` | `Member[]` | required | Array of member objects |
| `className` | `string` | `''` | Additional CSS class |

## Member Type

```typescript
interface Member {
  address: string;        // Stellar address
  hasContributed: boolean; // Whether member has contributed
  hasPaidOut: boolean;    // Whether member has been paid out
}
```

## Features

### Sorting
Click column headers to sort:
- **Member**: Sort alphabetically by address
- **Contributed**: Sort by contribution status
- **Paid Out**: Sort by payout status

Click again to reverse sort order (ascending ↑ / descending ↓).

### Address Display
- Full addresses are truncated to `GABC12...D890` format
- Hover over address to see full address in tooltip

### Status Badges
- ✓ Green badge = completed
- ○ Gray badge = pending

### Responsive Design
- Desktop: 3-column grid layout
- Tablet: Compact 3-column layout
- Mobile: Stacked single-column layout

## Testing

Run tests:
```bash
npm test -- MemberList.test.tsx
```

## Files Created
- `/frontend/src/components/MemberList.tsx` - Component implementation
- `/frontend/src/components/MemberList.css` - Component styles
- `/frontend/src/test/MemberList.test.tsx` - Component tests
- Updated `/frontend/src/components/index.ts` - Export MemberList
