# Design Document: browse-groups-page

## Overview

`BrowseGroupsPage` is a dedicated page in the Stellar Save frontend that lets users discover and explore public savings groups. It fetches groups once on mount via a new `fetchGroups` stub in `groupApi.ts`, then applies client-side search and filtering via `useMemo` before passing the filtered array to the existing `GroupList` component for rendering, pagination, and display.

The page reuses four existing components — `SearchBar`, `GroupFilters`, `GroupList`, and `GroupCard` — and follows the same `AppLayout` + `AppCard` shell pattern used by `DashboardPage`, `GroupsPage`, and `CreateGroupPage`.

---

## Architecture

### Data Flow

```mermaid
flowchart TD
    A[BrowseGroupsPage mounts] --> B[fetchGroups called once via useEffect]
    B -->|in-flight| C[loading = true → GroupList skeleton]
    B -->|error| D[error state → error message + Retry button]
    B -->|success| E[groups[] stored in state]
    E --> F[useMemo: apply searchQuery + FilterState]
    F --> G[filteredGroups[]]
    G --> H[GroupList receives filteredGroups]
    H --> I[GroupList paginates + renders GroupCard per item]
    J[SearchBar onChange] --> K[setSearchQuery + setPage 1]
    K --> F
    L[GroupFilters onFilterChange] --> M[setFilters + setPage 1]
    M --> F
```

### Component Tree

```
BrowseGroupsPage
├── AppLayout (title="Browse Groups", subtitle="Discover and join public savings groups")
│   └── AppCard
│       ├── <div aria-live="polite"> (error / empty announcements)
│       ├── SearchBar (aria-label="Search groups")
│       ├── GroupFilters (onFilterChange)
│       └── <div aria-busy={loading}>
│           └── GroupList
│               └── GroupCard × N (renderGroupItem)
```

---

## Components and Interfaces

### BrowseGroupsPage

Owns all page-level state. Passes derived data down; never passes raw setters to children.

| State field     | Type           | Purpose                                      |
|-----------------|----------------|----------------------------------------------|
| `groups`        | `PublicGroup[]`| Raw data from `fetchGroups`                  |
| `loading`       | `boolean`      | True while fetch is in-flight                |
| `error`         | `string \| null` | Error message; null when no error           |
| `searchQuery`   | `string`       | Current debounced search string              |
| `filters`       | `FilterState`  | Current filter/sort selections               |

Derived (via `useMemo`):

```ts
const filteredGroups = useMemo(() => {
  let result = groups;

  // 1. Search: name or description contains query (case-insensitive)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  }

  // 2. Status filter
  if (filters.status !== 'all') {
    result = result.filter(g => g.status === filters.status);
  }

  // 3. Amount range
  if (filters.minAmount) result = result.filter(g => g.contributionAmount >= Number(filters.minAmount));
  if (filters.maxAmount) result = result.filter(g => g.contributionAmount <= Number(filters.maxAmount));

  // 4. Member count range
  if (filters.minMembers) result = result.filter(g => g.memberCount >= Number(filters.minMembers));
  if (filters.maxMembers) result = result.filter(g => g.memberCount <= Number(filters.maxMembers));

  // 5. Sort
  return applySortOption(result, filters.sort);
}, [groups, searchQuery, filters]);
```

The `applySortOption` helper maps `FilterState.sort` (`SortOption`) to a comparator and returns a new sorted array.

### SearchBar usage

```tsx
<SearchBar
  placeholder="Search groups by name or keyword..."
  onSearch={(q) => { setSearchQuery(q); }}
  debounceMs={300}
  loading={loading}
  aria-label="Search groups"
/>
```

`SearchBar` already debounces internally. `BrowseGroupsPage` only stores the debounced value.

### GroupFilters usage

```tsx
<GroupFilters
  onFilterChange={(f) => { setFilters(f); }}
/>
```

`GroupFilters` owns its own internal UI state and calls `onFilterChange` on every change. `BrowseGroupsPage` stores the latest `FilterState`.

### GroupList usage

```tsx
<GroupList
  groups={filteredGroups}
  loading={loading}
  showSearch={false}
  showSort={false}
  pageSize={12}
  pageSizeOptions={[12, 24, 48]}
  showPagination={filteredGroups.length > 12}
  emptyTitle={hasActiveFilters ? 'No groups found' : 'No groups available'}
  emptyDescription={hasActiveFilters
    ? 'Try adjusting your search or filters to find groups.'
    : 'There are no public groups yet. Be the first to create one!'}
  emptyActionLabel={hasActiveFilters ? 'Clear Filters' : 'Create Group'}
  onEmptyAction={hasActiveFilters ? handleClearFilters : handleCreateGroup}
  renderGroupItem={(group) => (
    <GroupCard
      key={group.id}
      groupId={group.id}
      groupName={group.name}
      memberCount={group.memberCount}
      contributionAmount={group.contributionAmount}
      currency={group.currency}
      status={group.status}
      onViewDetails={() => navigate(buildRoute.groupDetail(group.id))}
      onJoin={group.status === 'active' || group.status === 'pending'
        ? () => handleJoin(group.id)
        : undefined}
    />
  )}
/>
```

`showSearch={false}` and `showSort={false}` disable `GroupList`'s internal search/sort bar since `BrowseGroupsPage` provides its own `SearchBar` and `GroupFilters` above it.

---

## Data Models

### PublicGroup

Added to `frontend/src/utils/groupApi.ts`. Extends the shape of `Group` from `GroupList.tsx` with required fields for the browse view.

```ts
export interface PublicGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  contributionAmount: number;   // in XLM
  currency: string;             // e.g. "XLM"
  status: 'active' | 'completed' | 'pending';
  createdAt: Date;
}
```

### fetchGroups stub

```ts
export async function fetchGroups(): Promise<PublicGroup[]> {
  // TODO: replace with actual Soroban contract invocation
  return Promise.resolve([]);
}
```

### FilterState (existing, from GroupFilters.tsx)

```ts
export interface FilterState {
  status: 'all' | 'active' | 'completed' | 'pending';
  minAmount: string;
  maxAmount: string;
  minMembers: string;
  maxMembers: string;
  sort: 'name-asc' | 'name-desc' | 'amount-asc' | 'amount-desc'
      | 'members-asc' | 'members-desc' | 'date-asc' | 'date-desc';
}
```

---

## Routing Changes

### constants.ts

Add `GROUPS_BROWSE: "/groups/browse"` to the `ROUTES` object.

```ts
export const ROUTES = {
  // ...existing...
  GROUPS_BROWSE: "/groups/browse",
  GROUP_DETAIL: "/groups/:groupId",   // must remain AFTER GROUPS_BROWSE
} as const;
```

### routes.tsx

Add the lazy-loaded route **before** `GROUP_DETAIL` to prevent `/groups/browse` from being matched as a `:groupId` param:

```ts
const BrowseGroupsPage = lazy(() => import("../pages/BrowseGroupsPage"));

// In routeConfig, insert before GROUP_DETAIL entry:
{
  path: ROUTES.GROUPS_BROWSE,
  component: BrowseGroupsPage,
  protected: true,
  title: "Browse Groups - Stellar Save",
  description: "Discover and join public savings groups",
},
```

---

## Empty State Logic

`hasActiveFilters` is a derived boolean:

```ts
const defaultFilters: FilterState = { status: 'all', minAmount: '', maxAmount: '', minMembers: '', maxMembers: '', sort: 'date-desc' };

const hasActiveFilters =
  searchQuery.trim() !== '' ||
  filters.status !== 'all' ||
  filters.minAmount !== '' ||
  filters.maxAmount !== '' ||
  filters.minMembers !== '' ||
  filters.maxMembers !== '';
```

| Condition | Title | Description | Action |
|-----------|-------|-------------|--------|
| `filteredGroups.length === 0 && !hasActiveFilters` | "No groups available" | "There are no public groups yet. Be the first to create one!" | "Create Group" → `/groups/create` |
| `filteredGroups.length === 0 && hasActiveFilters` | "No groups found" | "Try adjusting your search or filters to find groups." | "Clear Filters" → resets search + filters |

---

## Accessibility Implementation

- `<main>` wraps the page content area (provided by `AppLayout`).
- `<section aria-labelledby="browse-groups-heading">` wraps the search + filter + list area.
- `SearchBar` receives `aria-label="Search groups"` (passed as prop; `SearchBar` applies it to the `<input>`).
- The group list container receives `aria-busy={loading}`.
- A `<div aria-live="polite" aria-atomic="true">` at the top of `AppCard` announces error and empty state changes to screen readers.
- `GroupCard` buttons receive descriptive `aria-label` values: `"View details for {groupName}"` and `"Join {groupName}"`.
- Filter controls in `GroupFilters` already have visible `<label>` elements.

---

## Responsive Layout

`BrowseGroupsPage.css` defines a CSS grid for the group cards:

```css
.browse-groups-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;                          /* < 600px: 1 col */
}

@media (min-width: 600px) {
  .browse-groups-grid {
    grid-template-columns: repeat(2, 1fr);             /* 600–1023px: 2 cols */
  }
}

@media (min-width: 1024px) {
  .browse-groups-grid {
    grid-template-columns: repeat(3, 1fr);             /* ≥ 1024px: 3 cols */
  }
}
```

`GroupList`'s `renderGroupItem` wraps each `GroupCard` in a grid cell. The `SearchBar` and `GroupFilters` stack vertically on mobile and flow horizontally on wider viewports.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: fetchGroups resolves to a PublicGroup array

*For any* invocation of `fetchGroups`, the resolved value must be an array where every element has the required `PublicGroup` fields (`id`, `name`, `memberCount`, `contributionAmount`, `currency`, `status`, `createdAt`).

**Validates: Requirements 2.2**

---

### Property 2: Search filtering correctness

*For any* non-empty search query and any array of `PublicGroup` objects, every group in the filtered result must have its `name` or `description` contain the query string (case-insensitive), and clearing the search query must restore the full original array.

**Validates: Requirements 3.2, 3.4**

---

### Property 3: Filter criteria correctness

*For any* `FilterState` and any array of `PublicGroup` objects, every group in the filtered result must satisfy all active filter criteria simultaneously (status match, amount within range, member count within range) — i.e., search and filter are combined with logical AND.

**Validates: Requirements 4.2, 4.5**

---

### Property 4: Page resets to 1 on any state change

*For any* current page greater than 1, changing the search query or any filter value must reset the displayed page to 1.

**Validates: Requirements 3.3, 4.3**

---

### Property 5: Filter reset round-trip

*For any* `FilterState`, applying it and then clicking Reset must produce a `FilterState` equal to the default (`status: 'all'`, all range fields empty, `sort: 'date-desc'`), and the displayed groups must equal the full unfiltered list.

**Validates: Requirements 4.4**

---

### Property 6: GroupCard renders all required fields

*For any* array of `PublicGroup` objects passed to `BrowseGroupsPage`, each rendered `GroupCard` must display the group's `name`, `memberCount`, `contributionAmount`, `currency`, and `status` badge.

**Validates: Requirements 5.1**

---

### Property 7: Join button visibility matches group status

*For any* `PublicGroup`, the "Join Group" button must be present in the rendered `GroupCard` if and only if the group's `status` is `'active'` or `'pending'`; it must be absent for `'completed'` groups.

**Validates: Requirements 5.4**

---

### Property 8: Pagination hidden when results fit on one page

*For any* filtered group list whose length is 12 or fewer, the pagination controls must not be rendered.

**Validates: Requirements 6.4**

---

### Property 9: Page size constrains rendered card count

*For any* filtered group list larger than the current page size, the number of `GroupCard` components rendered must equal the page size (not the total list length).

**Validates: Requirements 6.1, 10.4**

---

### Property 10: GroupCard aria-labels include group name

*For any* `PublicGroup`, the "View Details" button's `aria-label` must contain the group's name (e.g., `"View details for {name}"`), and the "Join Group" button's `aria-label` must also contain the group's name.

**Validates: Requirements 9.6**

---

### Property 11: fetchGroups called exactly once on mount

*For any* sequence of search queries and filter changes applied after mount, `fetchGroups` must have been called exactly once (on mount), and must not be called again unless the Retry button is explicitly clicked.

**Validates: Requirements 10.3, 2.1**

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `fetchGroups` rejects with an `Error` | Display `err.message` if non-empty, else fallback "Failed to load groups. Please try again." |
| `fetchGroups` rejects with non-Error | Display fallback message |
| Retry clicked | Clear `error`, set `loading = true`, re-invoke `fetchGroups` |
| `fetchGroups` resolves with empty array | No error; show EmptyState via `GroupList` |

Error state is rendered inside the `aria-live="polite"` region so screen readers announce it automatically.

---

## Testing Strategy

### Unit Tests

Unit tests cover specific examples, edge cases, and integration points. They live in `frontend/src/test/BrowseGroupsPage.test.tsx`.

Key examples to cover:
- Page renders with `AppLayout`, correct title and subtitle (Req 1.1, 1.2)
- Route `/groups/browse` renders `BrowseGroupsPage` (Req 1.3)
- `fetchGroups` is called once on mount (Req 2.1)
- Loading skeleton is shown while fetch is pending (Req 2.3)
- Groups are passed to `GroupList` after successful fetch (Req 2.4)
- Error message and Retry button appear on fetch failure (Req 2.5, 8.1, 8.2)
- Retry button re-invokes `fetchGroups` (Req 2.6, 8.3)
- Fallback error message when error has no message (Req 8.4 — edge case)
- `SearchBar` renders with correct placeholder (Req 3.1)
- `GroupFilters` renders (Req 4.1)
- EmptyState "No groups available" + "Create Group" button when no groups and no filters (Req 7.1, 7.3)
- EmptyState "No groups found" + "Clear Filters" button when search active (Req 7.2, 7.4)
- `aria-busy="true"` on list container during loading (Req 9.4)
- `aria-live="polite"` region present (Req 9.5)
- `SearchBar` has `aria-label="Search groups"` (Req 9.2)
- Debounce: search fires after 300ms, not immediately (Req 3.5, 10.2)

### Property-Based Tests

Property tests use **fast-check** (already available in the JS ecosystem; install with `npm install --save-dev fast-check`). Each test runs a minimum of **100 iterations**.

Tests live in `frontend/src/test/BrowseGroupsPage.property.test.tsx`.

Each test is tagged with a comment in the format:
`// Feature: browse-groups-page, Property {N}: {property_text}`

| Test | Property | fast-check arbitraries |
|------|----------|------------------------|
| P1: fetchGroups shape | Resolved value is `PublicGroup[]` with all required fields | `fc.array(fc.record({id, name, memberCount, ...}))` |
| P2: Search filtering | All results contain query in name/description; clear restores full list | `fc.array(PublicGroupArb)`, `fc.string()` |
| P3: Filter correctness | All results satisfy active filter criteria (AND logic) | `fc.array(PublicGroupArb)`, `FilterStateArb` |
| P4: Page reset | Any search/filter change resets page to 1 | `fc.array(PublicGroupArb)`, `fc.string()`, `FilterStateArb` |
| P5: Filter reset round-trip | Reset returns to default FilterState | `FilterStateArb` |
| P6: GroupCard fields | Each card displays all required PublicGroup fields | `fc.array(PublicGroupArb, {minLength: 1})` |
| P7: Join button visibility | Join button iff status active or pending | `PublicGroupArb` |
| P8: Pagination hidden ≤12 | No pagination when ≤12 filtered results | `fc.array(PublicGroupArb, {maxLength: 12})` |
| P9: Page size constraint | Rendered card count ≤ page size | `fc.array(PublicGroupArb, {minLength: 13})`, `fc.constantFrom(12, 24, 48)` |
| P10: aria-labels | Buttons contain group name in aria-label | `PublicGroupArb` |
| P11: Fetch called once | fetchGroups call count = 1 after N state changes | `fc.array(fc.string())`, `fc.array(FilterStateArb)` |

**Configuration example:**

```ts
// Feature: browse-groups-page, Property 2: Search filtering correctness
it('all filtered results contain the search query', () => {
  fc.assert(
    fc.property(fc.array(PublicGroupArb), fc.string({ minLength: 1 }), (groups, query) => {
      const result = applySearch(groups, query);
      const q = query.toLowerCase();
      return result.every(
        g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
      );
    }),
    { numRuns: 100 }
  );
});
```

---

## File Structure Summary

```
frontend/src/
├── pages/
│   ├── BrowseGroupsPage.tsx        ← new page component
│   └── BrowseGroupsPage.css        ← responsive grid + page styles
├── utils/
│   └── groupApi.ts                 ← add PublicGroup interface + fetchGroups stub
├── routing/
│   ├── constants.ts                ← add GROUPS_BROWSE: "/groups/browse"
│   └── routes.tsx                  ← add BrowseGroupsPage route before GROUP_DETAIL
└── test/
    ├── BrowseGroupsPage.test.tsx           ← unit + integration tests
    └── BrowseGroupsPage.property.test.tsx  ← fast-check property tests
```
