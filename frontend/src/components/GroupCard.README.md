# GroupCard Component

A card component for displaying group summary information including name, stats, member count, and contribution amounts.

## Features

- Display group name with status badge
- Show member count and total contributions
- Configurable action buttons (View Details, Join Group)
- Clickable card with hover effects
- Responsive design for mobile and desktop
- Loading skeleton component available

## Usage

```tsx
import { GroupCard } from './components';

function GroupList() {
  return (
    <GroupCard
      groupName="Savings Circle Alpha"
      memberCount={12}
      contributionAmount={5000}
      currency="XLM"
      status="active"
      onClick={() => console.log('Card clicked')}
      onViewDetails={() => console.log('View details')}
      onJoin={() => console.log('Join group')}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `groupName` | `string` | required | Name of the group |
| `memberCount` | `number` | required | Number of members in the group |
| `contributionAmount` | `number` | required | Total contribution amount |
| `currency` | `string` | `'XLM'` | Currency symbol to display |
| `status` | `'active' \| 'completed' \| 'pending'` | `'active'` | Group status |
| `onClick` | `() => void` | - | Handler for card click |
| `onViewDetails` | `() => void` | - | Handler for View Details button |
| `onJoin` | `() => void` | - | Handler for Join Group button |
| `className` | `string` | `''` | Additional CSS classes |

## Status Variants

- `active` - Green badge, indicates active group
- `completed` - Blue badge, indicates completed group
- `pending` - Yellow badge, indicates pending group

## Loading State

Use `GroupCardSkeleton` for loading states:

```tsx
import { GroupCardSkeleton } from './components';

function GroupList({ loading, groups }) {
  if (loading) {
    return (
      <>
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </>
    );
  }

  return groups.map(group => <GroupCard key={group.id} {...group} />);
}
```

## Examples

### Basic Card
```tsx
<GroupCard
  groupName="Monthly Savings"
  memberCount={8}
  contributionAmount={2500}
/>
```

### With Actions
```tsx
<GroupCard
  groupName="Emergency Fund"
  memberCount={15}
  contributionAmount={10000}
  currency="USD"
  status="active"
  onViewDetails={() => navigate(`/groups/${groupId}`)}
  onJoin={() => handleJoinGroup(groupId)}
/>
```

### Grid Layout
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
  {groups.map(group => (
    <GroupCard
      key={group.id}
      groupName={group.name}
      memberCount={group.members}
      contributionAmount={group.total}
      onClick={() => handleCardClick(group.id)}
    />
  ))}
</div>
```

## Accessibility

- Card is keyboard accessible and clickable
- Action buttons prevent event bubbling to card click
- Semantic HTML structure with proper heading hierarchy
- Responsive design adapts to screen sizes

## Styling

The component uses CSS custom properties and follows the existing design system:
- Primary color: `#646cff`
- Dark background: `#1a1a1a`
- Border color: `#333`
- Hover effects with transform and shadow
- Light mode support via `prefers-color-scheme`
