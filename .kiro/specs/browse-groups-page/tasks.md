# Implementation Plan: browse-groups-page

## Overview

Implement the `BrowseGroupsPage` feature by extending `groupApi.ts` with the `PublicGroup` interface and `fetchGroups` stub, registering the route, building the page component with client-side search/filter/sort via `useMemo`, and wiring it to the existing `SearchBar`, `GroupFilters`, `GroupList`, and `GroupCard` components.

## Tasks

- [x] 1. Extend groupApi.ts with PublicGroup interface and fetchGroups stub
  - Add `PublicGroup` interface with fields: `id`, `name`, `description?`, `memberCount`, `contributionAmount`, `currency`, `status`, `createdAt`
  - Add `fetchGroups(): Promise<PublicGroup[]>` stub that resolves to `[]`
  - _Requirements: 2.2_

  - [ ]* 1.1 Write property test for fetchGroups shape (Property 1)
    - **Property 1: fetchGroups resolves to a PublicGroup array**
    - **Validates: Requirements 2.2**

- [x] 2. Add GROUPS_BROWSE route constant and register the page route
  - Add `GROUPS_BROWSE: "/groups/browse"` to `ROUTES` in `frontend/src/routing/constants.ts`
  - Add lazy `BrowseGroupsPage` import and route entry in `frontend/src/routing/routes.tsx` **before** the `GROUP_DETAIL` entry to prevent param collision
  - _Requirements: 1.3, 1.4_

- [x] 3. Create BrowseGroupsPage.css with responsive grid layout
  - Define `.browse-groups-grid` CSS grid: 1 col default, 2 cols at ≥600px, 3 cols at ≥1024px
  - Define `.browse-groups-controls` layout: vertical stack on mobile, horizontal row on wider viewports
  - _Requirements: 1.5, 5.5_

- [x] 4. Implement BrowseGroupsPage component — state, data fetching, and error handling
  - Create `frontend/src/pages/BrowseGroupsPage.tsx`
  - Declare state: `groups: PublicGroup[]`, `loading: boolean`, `error: string | null`, `searchQuery: string`, `filters: FilterState`
  - Call `fetchGroups()` once on mount via `useEffect`; set `loading` before call, populate `groups` on success, set `error` on failure
  - Implement retry handler: clear error, set loading, re-invoke `fetchGroups`
  - Render `AppLayout` with title "Browse Groups" and subtitle "Discover and join public savings groups"
  - Render `<div aria-live="polite" aria-atomic="true">` for error announcements
  - Render error message + "Retry" button when `error` is non-null
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 2.5, 2.6, 8.1, 8.2, 8.3, 8.4_

- [x] 5. Implement filteredGroups useMemo and hasActiveFilters derived value
  - Add `applySortOption` helper that maps `FilterState.sort` to a comparator
  - Implement `filteredGroups` via `useMemo`: apply search (name/description, case-insensitive), status filter, amount range, member range, then sort
  - Implement `hasActiveFilters` boolean: true when `searchQuery` is non-empty or any filter differs from default
  - _Requirements: 3.2, 3.4, 4.2, 4.5, 10.1_

  - [ ]* 5.1 Write property test for search filtering correctness (Property 2)
    - **Property 2: Search filtering correctness**
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 5.2 Write property test for filter criteria correctness (Property 3)
    - **Property 3: Filter criteria correctness**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 5.3 Write property test for filter reset round-trip (Property 5)
    - **Property 5: Filter reset round-trip**
    - **Validates: Requirements 4.4**

- [x] 6. Wire SearchBar and GroupFilters into BrowseGroupsPage
  - Render `<SearchBar>` with `placeholder="Search groups by name or keyword..."`, `onSearch` sets `searchQuery`, `debounceMs={300}`, `loading={loading}`, `aria-label="Search groups"`
  - Render `<GroupFilters>` with `onFilterChange` that sets `filters`
  - Both handlers also reset page to 1 (handled internally by `GroupList` when `groups` prop changes)
  - Wrap controls in `<section aria-labelledby="browse-groups-heading">`
  - _Requirements: 3.1, 3.3, 3.5, 4.1, 4.3, 9.2, 9.3_

  - [ ]* 6.1 Write property test for page reset on state change (Property 4)
    - **Property 4: Page resets to 1 on any state change**
    - **Validates: Requirements 3.3, 4.3**

- [x] 7. Wire GroupList with GroupCard renderGroupItem
  - Render `<div aria-busy={loading}>` wrapping `GroupList`
  - Pass `groups={filteredGroups}`, `loading={loading}`, `showSearch={false}`, `showSort={false}`, `pageSize={12}`, `pageSizeOptions={[12, 24, 48]}`, `showPagination={filteredGroups.length > 12}`
  - Pass `emptyTitle`, `emptyDescription`, `emptyActionLabel`, `onEmptyAction` based on `hasActiveFilters`
  - Implement `renderGroupItem` rendering `<GroupCard>` with `aria-label` on "View Details" (`"View details for {groupName}"`) and "Join Group" (`"Join {groupName}"`) buttons; pass `onJoin` only when status is `active` or `pending`
  - Implement `handleClearFilters` (reset `searchQuery` and `filters` to defaults) and `handleCreateGroup` (navigate to `/groups/create`)
  - _Requirements: 2.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 9.4, 9.5, 9.6, 10.4_

  - [ ]* 7.1 Write property test for GroupCard renders all required fields (Property 6)
    - **Property 6: GroupCard renders all required fields**
    - **Validates: Requirements 5.1**

  - [ ]* 7.2 Write property test for Join button visibility matches group status (Property 7)
    - **Property 7: Join button visibility matches group status**
    - **Validates: Requirements 5.4**

  - [ ]* 7.3 Write property test for pagination hidden when results fit on one page (Property 8)
    - **Property 8: Pagination hidden when results fit on one page**
    - **Validates: Requirements 6.4**

  - [ ]* 7.4 Write property test for page size constrains rendered card count (Property 9)
    - **Property 9: Page size constrains rendered card count**
    - **Validates: Requirements 6.1, 10.4**

  - [ ]* 7.5 Write property test for GroupCard aria-labels include group name (Property 10)
    - **Property 10: GroupCard aria-labels include group name**
    - **Validates: Requirements 9.6**

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Write unit tests for BrowseGroupsPage
  - Create `frontend/src/test/BrowseGroupsPage.test.tsx`
  - Cover: page renders with correct title/subtitle (Req 1.1, 1.2); `fetchGroups` called once on mount (Req 2.1); loading skeleton shown while fetch pending (Req 2.3); groups passed to `GroupList` after success (Req 2.4); error message + Retry button on failure (Req 2.5, 8.1, 8.2); Retry re-invokes `fetchGroups` (Req 2.6, 8.3); fallback error message when error has no message (Req 8.4); `SearchBar` renders with correct placeholder (Req 3.1); `GroupFilters` renders (Req 4.1); EmptyState "No groups available" + "Create Group" when no groups and no filters (Req 7.1, 7.3); EmptyState "No groups found" + "Clear Filters" when search active (Req 7.2, 7.4); `aria-busy="true"` during loading (Req 9.4); `aria-live="polite"` region present (Req 9.5); `SearchBar` has `aria-label="Search groups"` (Req 9.2)
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 2.4, 2.5, 2.6, 3.1, 4.1, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.2, 9.4, 9.5_

  - [ ]* 9.1 Write property test for fetchGroups called exactly once on mount (Property 11)
    - **Property 11: fetchGroups called exactly once on mount**
    - **Validates: Requirements 10.3, 2.1**

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests live in `frontend/src/test/BrowseGroupsPage.property.test.tsx` and use **fast-check** (`npm install --save-dev fast-check`)
- Unit tests live in `frontend/src/test/BrowseGroupsPage.test.tsx`
- Route must be registered before `GROUP_DETAIL` in `routes.tsx` to prevent `/groups/browse` matching as a `:groupId` param
