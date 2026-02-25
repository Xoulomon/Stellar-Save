# GroupList Component

A comprehensive list component for displaying and managing groups with built-in search, sorting, pagination, and loading states.

## Features

- ✅ Display multiple groups in a list format
- ✅ Empty state handling
- ✅ Loading state with skeleton loaders
- ✅ Pagination with customizable page sizes
- ✅ Sorting by name, member count, or creation date
- ✅ Search/filtering functionality
- ✅ Responsive design
- ✅ Customizable rendering
- ✅ Accessibility compliant

## Basic Usage

```tsx
import { GroupList, Group } from './components';

const groups: Group[] = [
  {
    id: '1',
    name: 'Developers',
    description: 'Software development team',
    memberCount: 15,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Designers',
    description: 'UI/UX design team',
    memberCount: 8,
    createdAt: new Date('2024-02-01'),
  },
];

function MyComponent() {
  return (
    <GroupList
      groups={groups}
      onGroupClick={(group) => console.log('Clicked:', group)}
    />
  );
}
```

## Props

### Required Props

None - all props are optional with sensible defaults.

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `groups` | `Group[]` | `[]` | Array of group objects to display |
| `loading` | `boolean` | `false` | Shows skeleton loading state |
| `emptyTitle` | `string` | `'No groups found'` | Title for empty state |
| `emptyDescription` | `string` | `'There are no groups to display.'` | Description for empty state |
| `emptyActionLabel` | `string` | `undefined` | Label for empty state action button |
| `onEmptyAction` | `() => void` | `undefined` | Callback for empty state action |
| `onGroupClick` | `(group: Group) => void` | `undefined` | Callback when a group is clicked |
| `renderGroupItem` | `(group: Group) => ReactNode` | Default renderer | Custom renderer for group items |
| `pageSize` | `number` | `10` | Number of items per page |
| `pageSizeOptions` | `number[]` | `[10, 25, 50]` | Available page size options |
| `showPagination` | `boolean` | `true` | Show/hide pagination controls |
| `showSearch` | `boolean` | `true` | Show/hide search bar |
| `showSort` | `boolean` | `true` | Show/hide sort dropdown |
| `searchPlaceholder` | `string` | `'Search groups...'` | Placeholder text for search |
| `defaultSortField` | `'name' \| 'memberCount' \| 'createdAt'` | `'name'` | Default sort field |
| `defaultSortOrder` | `'asc' \| 'desc'` | `'asc'` | Default sort order |
| `className` | `string` | `''` | Additional CSS class |

## Group Interface

```typescript
interface Group {
  id: string;                // Required: Unique identifier
  name: string;              // Required: Group name
  description?: string;      // Optional: Group description
  memberCount?: number;      // Optional: Number of members
  createdAt?: Date;          // Optional: Creation date
  avatar?: string;           // Optional: Avatar image URL
  [key: string]: any;        // Additional custom properties
}
```

## Examples

### With Loading State

```tsx
<GroupList
  groups={[]}
  loading={true}
/>
```

### With Empty State Action

```tsx
<GroupList
  groups={[]}
  emptyTitle="No groups yet"
  emptyDescription="Create your first group to get started"
  emptyActionLabel="Create Group"
  onEmptyAction={() => navigate('/groups/new')}
/>
```

### Custom Rendering

```tsx
<GroupList
  groups={groups}
  renderGroupItem={(group) => (
    <div className="custom-group-item">
      <h3>{group.name}</h3>
      <p>{group.description}</p>
      <button onClick={() => joinGroup(group.id)}>Join</button>
    </div>
  )}
/>
```

### Without Search or Sort

```tsx
<GroupList
  groups={groups}
  showSearch={false}
  showSort={false}
/>
```

### Custom Pagination

```tsx
<GroupList
  groups={groups}
  pageSize={25}
  pageSizeOptions={[25, 50, 100]}
/>
```

### Default Sorting

```tsx
<GroupList
  groups={groups}
  defaultSortField="memberCount"
  defaultSortOrder="desc"
/>
```

## Styling

The component uses CSS classes that can be customized:

- `.group-list` - Main container
- `.group-list-controls` - Search and sort controls
- `.group-list-search` - Search bar container
- `.group-list-sort-button` - Sort button
- `.group-list-content` - Content area
- `.group-list-items` - Items container
- `.group-list-item` - Individual group item
- `.group-list-item-content` - Item content wrapper
- `.group-list-item-avatar` - Avatar image
- `.group-list-item-avatar-placeholder` - Avatar placeholder
- `.group-list-item-details` - Item details container
- `.group-list-item-name` - Group name
- `.group-list-item-description` - Group description
- `.group-list-item-meta` - Metadata container
- `.group-list-pagination` - Pagination container

## Accessibility

The component follows accessibility best practices:

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- Focus management

## Responsive Design

The component is fully responsive and adapts to different screen sizes:

- Mobile: Stacked layout with full-width controls
- Tablet/Desktop: Horizontal layout with flexible controls

## Performance

- Efficient filtering and sorting with `useMemo`
- Pagination reduces DOM nodes
- Debounced search to minimize re-renders
- Skeleton loading for perceived performance
