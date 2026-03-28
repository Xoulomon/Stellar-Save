# CycleProgress Component

Display current cycle progress with time remaining, contribution tracking, and visual progress indicators.

## Features

- **Cycle Number**: Display current cycle identifier
- **Time Remaining**: Countdown to cycle deadline (days, hours, minutes)
- **Contribution Progress**: Track member contributions with progress bar
- **Amount Progress**: Track collected amount vs target with progress bar
- **Status Badge**: Visual indicator for cycle status (active, completed, pending)
- **Overdue Indicator**: Highlight when deadline has passed
- **Completion Message**: Show when all members have contributed
- **Responsive**: Mobile-friendly layout

## Usage

```tsx
import { CycleProgress } from './components';

function MyComponent() {
  return (
    <CycleProgress
      cycleNumber={3}
      deadline={new Date('2026-03-01')}
      contributedCount={8}
      totalMembers={10}
      targetAmount={1000}
      currentAmount={800}
      status="active"
    />
  );
}
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `cycleNumber` | `number` | Yes | - | Current cycle number |
| `deadline` | `Date` | Yes | - | Cycle deadline |
| `contributedCount` | `number` | Yes | - | Number of members who contributed |
| `totalMembers` | `number` | Yes | - | Total members in group |
| `targetAmount` | `number` | Yes | - | Target amount to collect |
| `currentAmount` | `number` | No | `0` | Current collected amount |
| `status` | `'active' \| 'completed' \| 'pending'` | No | `'active'` | Cycle status |

## Examples

### Active Cycle
```tsx
<CycleProgress
  cycleNumber={1}
  deadline={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)} // 5 days
  contributedCount={7}
  totalMembers={10}
  targetAmount={5000}
  currentAmount={3500}
  status="active"
/>
```

### Completed Cycle
```tsx
<CycleProgress
  cycleNumber={2}
  deadline={new Date('2026-02-20')}
  contributedCount={10}
  totalMembers={10}
  targetAmount={5000}
  currentAmount={5000}
  status="completed"
/>
```

### Overdue Cycle
```tsx
<CycleProgress
  cycleNumber={3}
  deadline={new Date('2026-02-15')} // Past date
  contributedCount={6}
  totalMembers={10}
  targetAmount={5000}
  currentAmount={3000}
  status="active"
/>
```

## Visual Indicators

- **Progress Bars**: Two bars showing contribution and amount progress
- **Status Badge**: Color-coded badge (success/warning/info)
- **Time Display**: Countdown with overdue highlighting
- **Completion Message**: Green banner when all members contributed
- **Stats Grid**: Quick overview of key metrics

## Styling

Uses CSS custom properties for theming:

- `--color-border`: Border color
- `--color-primary`: Primary progress bar color
- `--color-success`: Success/amount progress color
- `--color-success-light`: Success background
- `--color-error`: Overdue time color
- `--color-text-primary`: Primary text
- `--color-text-secondary`: Secondary text
- `--color-background-secondary`: Stats background

## Time Formatting

- **Days**: Shows "Xd Yh" when > 24 hours remaining
- **Hours**: Shows "Xh" when < 24 hours remaining
- **Minutes**: Shows "Xm" when < 1 hour remaining
- **Ended**: Shows "Ended" when deadline passed

## Dependencies

- `Badge` component for status display
