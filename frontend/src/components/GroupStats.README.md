# GroupStats Component

A responsive component for displaying group statistics and metrics with visual progress indicators.

## Features

- ✅ Display total contributed amount
- ✅ Display total paid out amount
- ✅ Show completion percentage with visual progress bar
- ✅ Show payout progress with visual progress bar
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Customizable currency display
- ✅ Elevated card variant for visual hierarchy

## Usage

```tsx
import { GroupStats } from './components/GroupStats';

function MyComponent() {
  return (
    <GroupStats
      totalContributed={5000}
      totalPaidOut={3000}
      totalExpected={10000}
      currency="XLM"
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `totalContributed` | `number` | Required | Total amount contributed by all members |
| `totalPaidOut` | `number` | Required | Total amount paid out to members |
| `totalExpected` | `number` | Required | Expected total contributions for the group |
| `currency` | `string` | `'XLM'` | Currency symbol to display |
| `className` | `string` | `''` | Additional CSS classes |

## Visual Elements

### Statistics Grid
- **Total Contributed**: Shows the sum of all contributions
- **Total Paid Out**: Shows the sum of all payouts
- **Completion Progress**: Visual bar showing contribution progress
- **Payout Progress**: Visual bar showing payout distribution

### Progress Bars
- Blue gradient for completion progress
- Green gradient for payout progress
- Smooth transitions on value changes
- Percentage labels for quick reference

## Responsive Breakpoints

- **Desktop** (>768px): 2-column grid for stats
- **Tablet** (≤768px): Single column layout
- **Mobile** (≤480px): Compact spacing and smaller fonts

## Examples

### Basic Usage
```tsx
<GroupStats
  totalContributed={10000}
  totalPaidOut={5000}
  totalExpected={20000}
/>
```

### With Custom Currency
```tsx
<GroupStats
  totalContributed={1000}
  totalPaidOut={500}
  totalExpected={2000}
  currency="USDC"
/>
```

### With Custom Styling
```tsx
<GroupStats
  totalContributed={5000}
  totalPaidOut={2500}
  totalExpected={10000}
  className="my-custom-stats"
/>
```

## Calculations

- **Completion Percentage**: `(totalContributed / totalExpected) * 100`
- **Payout Percentage**: `(totalPaidOut / totalContributed) * 100`

Both percentages are rounded to the nearest integer.

## Accessibility

- Semantic HTML structure
- Clear label-value relationships
- Readable color contrasts
- Responsive text sizing

## Testing

Run tests with:
```bash
npm test GroupStats.test.tsx
```

See `src/test/GroupStats.test.tsx` for test coverage.
