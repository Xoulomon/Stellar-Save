# GroupFilters Component

Filtering interface for group lists with status, contribution amount, member count filters and sort options.

## Features

- **Status Filter**: Filter by group status (all, active, completed, pending)
- **Contribution Amount Filter**: Range filter for contribution amounts (min/max)
- **Member Count Filter**: Range filter for member counts (min/max)
- **Sort Options**: 8 sort options (name, amount, members, date - ascending/descending)
- **Reset**: Clear all filters to defaults
- **Real-time Updates**: Filters apply immediately on change

## Usage

```tsx
import { GroupFilters, FilterState } from './components';

function MyComponent() {
  const handleFilterChange = (filters: FilterState) => {
    console.log('Filters:', filters);
    // Apply filters to your group list
  };

  return (
    <GroupFilters 
      onFilterChange={handleFilterChange}
      initialFilters={{ status: 'active', sort: 'members-desc' }}
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onFilterChange` | `(filters: FilterState) => void` | Yes | Callback when filters change |
| `initialFilters` | `Partial<FilterState>` | No | Initial filter values |

## FilterState Type

```typescript
interface FilterState {
  status: 'all' | 'active' | 'completed' | 'pending';
  minAmount: string;
  maxAmount: string;
  minMembers: string;
  maxMembers: string;
  sort: SortOption;
}

type SortOption = 
  | 'name-asc' | 'name-desc' 
  | 'amount-asc' | 'amount-desc' 
  | 'members-asc' | 'members-desc' 
  | 'date-asc' | 'date-desc';
```

## Integration Example

```tsx
import { useState } from 'react';
import { GroupFilters, GroupList, FilterState } from './components';

function GroupsPage() {
  const [filters, setFilters] = useState<FilterState>();
  const [groups, setGroups] = useState([]);

  const filteredGroups = groups.filter(group => {
    if (!filters) return true;
    
    // Status filter
    if (filters.status !== 'all' && group.status !== filters.status) {
      return false;
    }
    
    // Amount filter
    if (filters.minAmount && group.contributionAmount < Number(filters.minAmount)) {
      return false;
    }
    if (filters.maxAmount && group.contributionAmount > Number(filters.maxAmount)) {
      return false;
    }
    
    // Member count filter
    if (filters.minMembers && group.memberCount < Number(filters.minMembers)) {
      return false;
    }
    if (filters.maxMembers && group.memberCount > Number(filters.maxMembers)) {
      return false;
    }
    
    return true;
  });

  return (
    <div>
      <GroupFilters onFilterChange={setFilters} />
      <GroupList groups={filteredGroups} />
    </div>
  );
}
```

## Styling

The component uses CSS custom properties for theming:

- `--color-background-secondary`: Filter panel background
- `--color-border`: Border color
- `--color-primary`: Accent color
- `--color-text-secondary`: Label text color
- `--color-background-hover`: Hover state background

## Dependencies

- `Input` component
- `Dropdown` component
- `Button` component
