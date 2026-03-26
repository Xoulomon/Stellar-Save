# Requirements Document

## Introduction

This feature introduces a `BrowseGroupsPage` — a fully responsive page in the Stellar Save web application that enables users to discover and explore public savings groups. The page fetches and displays a paginated list of public groups, supports real-time search by name or keywords, provides filtering options (status, contribution amount range, member count range, sort order), and handles loading, error, and empty states clearly. It reuses existing components (`GroupCard`, `GroupFilters`, `GroupList`, `SearchBar`) and extends `groupApi.ts` with a `fetchGroups` function.

## Glossary

- **BrowseGroupsPage**: The top-level page component that hosts the group browsing experience.
- **GroupCard**: The existing reusable card component that displays a single group's summary (name, member count, contribution amount, status).
- **GroupList**: The existing reusable list component that renders a collection of `GroupCard` items with built-in search, sort, and pagination.
- **GroupFilters**: The existing reusable filter bar component that exposes status, sort, contribution amount range, and member count range controls.
- **SearchBar**: The existing reusable debounced search input component.
- **FilterState**: The object describing the active filter and sort selections (status, minAmount, maxAmount, minMembers, maxMembers, sort).
- **PublicGroup**: A group record returned by the API that is visible to all users regardless of membership.
- **API_Handler**: The `fetchGroups` async function added to `groupApi.ts` responsible for retrieving public group data.
- **LoadingState**: The UI state displayed while the `API_Handler` call is in-flight (skeleton cards).
- **ErrorState**: The UI state displayed when the `API_Handler` call fails.
- **EmptyState**: The UI state displayed when no groups match the current search and filter criteria.
- **Router**: The React Router v6 instance used for navigation.
- **Pagination**: The page-number and next/previous controls rendered by the `GroupList` component.

---

## Requirements

### Requirement 1: Page Rendering and Layout

**User Story:** As a user, I want to navigate to a dedicated Browse Groups page, so that I can discover available public savings groups in a focused view.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL render within the existing `AppLayout` component, consistent with other pages such as `GroupsPage` and `DashboardPage`.
2. THE `BrowseGroupsPage` SHALL display a page title of "Browse Groups" and a subtitle of "Discover and join public savings groups".
3. THE `BrowseGroupsPage` SHALL be accessible at the route `/groups/browse`.
4. WHEN a user navigates to `/groups/browse`, THE `Router` SHALL render `BrowseGroupsPage` without a full page reload.
5. THE `BrowseGroupsPage` SHALL be fully responsive, adapting its layout for viewport widths of 320px (mobile), 768px (tablet), and 1024px and above (desktop).

---

### Requirement 2: Data Fetching

**User Story:** As a user, I want the page to automatically load available groups when I open it, so that I can immediately start browsing without manual action.

#### Acceptance Criteria

1. WHEN `BrowseGroupsPage` mounts, THE `API_Handler` SHALL be invoked to fetch the list of public groups.
2. THE `API_Handler` (`fetchGroups`) SHALL be added to `groupApi.ts` and SHALL return a `Promise` resolving to an array of `PublicGroup` objects.
3. WHILE the `API_Handler` call is in-flight, THE `BrowseGroupsPage` SHALL display the `LoadingState` using skeleton cards via the `GroupList` component's `loading` prop.
4. WHEN the `API_Handler` resolves successfully, THE `BrowseGroupsPage` SHALL pass the returned group array to the `GroupList` component for display.
5. IF the `API_Handler` rejects or throws an error, THEN THE `BrowseGroupsPage` SHALL display the `ErrorState` with the message "Failed to load groups. Please try again." and a retry button.
6. WHEN the retry button is clicked, THE `BrowseGroupsPage` SHALL re-invoke the `API_Handler` to attempt fetching groups again.

---

### Requirement 3: Search Functionality

**User Story:** As a user, I want to search groups by name or keywords, so that I can quickly find groups relevant to my interests.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL render the `SearchBar` component with the placeholder "Search groups by name or keyword...".
2. WHEN the user types in the `SearchBar`, THE `BrowseGroupsPage` SHALL filter the displayed groups to those whose `name` or `description` contains the search query (case-insensitive) within 300 milliseconds of the last keystroke.
3. WHEN the search query changes, THE `BrowseGroupsPage` SHALL reset the current page to 1.
4. WHEN the search query is cleared, THE `BrowseGroupsPage` SHALL restore the full unfiltered group list.
5. THE `SearchBar` SHALL display a loading indicator while the debounce timer is active.

---

### Requirement 4: Filtering Options

**User Story:** As a user, I want to filter groups by status, contribution amount, and member count, so that I can narrow results to groups that match my criteria.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL render the `GroupFilters` component, exposing controls for: status (`all`, `active`, `completed`, `pending`), sort order (name A-Z/Z-A, amount low/high, members low/high, date newest/oldest), minimum contribution amount, maximum contribution amount, minimum member count, and maximum member count.
2. WHEN the user changes any filter, THE `BrowseGroupsPage` SHALL re-apply all active filters to the group list within one render cycle.
3. WHEN the user changes any filter, THE `BrowseGroupsPage` SHALL reset the current page to 1.
4. WHEN the user clicks the "Reset" button in `GroupFilters`, THE `BrowseGroupsPage` SHALL restore all filters to their default values and display the full unfiltered group list.
5. WHEN both a search query and one or more filters are active simultaneously, THE `BrowseGroupsPage` SHALL apply both the search and filter criteria together (logical AND).

---

### Requirement 5: Group Display

**User Story:** As a user, I want each group to be displayed as a clear, informative card, so that I can compare groups at a glance.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL render each `PublicGroup` using the existing `GroupCard` component, displaying: group name, member count, contribution amount (in XLM), and status badge.
2. WHEN a user clicks a `GroupCard`, THE `Router` SHALL navigate to the group detail route `/groups/:groupId`.
3. THE `GroupCard` SHALL display a "View Details" button that navigates to `/groups/:groupId` when clicked.
4. THE `GroupCard` SHALL display a "Join Group" button for groups with status `active` or `pending`.
5. THE `BrowseGroupsPage` SHALL render groups in a responsive grid layout: 1 column on viewports narrower than 600px, 2 columns on viewports 600px–1023px, and 3 columns on viewports 1024px and wider.

---

### Requirement 6: Pagination

**User Story:** As a user, I want paginated results, so that the page remains performant and navigable even when many groups exist.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL display groups in pages of 12 items by default, using the `GroupList` component's pagination controls.
2. THE `GroupList` pagination controls SHALL include previous page, next page, and individual page number buttons.
3. WHEN the user navigates to a new page, THE `BrowseGroupsPage` SHALL scroll to the top of the group list.
4. WHEN the total number of filtered groups is 12 or fewer, THE `BrowseGroupsPage` SHALL hide the pagination controls.
5. THE `BrowseGroupsPage` SHALL allow the user to change the page size to 12, 24, or 48 items per page.

---

### Requirement 7: Empty State

**User Story:** As a user, when no groups match my search or filter criteria, I want to see a helpful message, so that I understand why the list is empty and know what to do next.

#### Acceptance Criteria

1. WHEN the filtered group list is empty and no search query or filters are active, THE `BrowseGroupsPage` SHALL display the `EmptyState` component with the title "No groups available" and the description "There are no public groups yet. Be the first to create one!".
2. WHEN the filtered group list is empty and a search query or filter is active, THE `BrowseGroupsPage` SHALL display the `EmptyState` component with the title "No groups found" and the description "Try adjusting your search or filters to find groups.".
3. WHEN the `EmptyState` is displayed with no active search or filters, THE `BrowseGroupsPage` SHALL render a "Create Group" action button in the `EmptyState` that navigates to `/groups/create`.
4. WHEN the `EmptyState` is displayed with an active search or filter, THE `BrowseGroupsPage` SHALL render a "Clear Filters" action button in the `EmptyState` that resets all search and filter state.

---

### Requirement 8: Error Handling

**User Story:** As a user, if loading groups fails, I want to see a clear error message with a way to retry, so that I can recover without refreshing the entire page.

#### Acceptance Criteria

1. WHEN the `API_Handler` rejects, THE `BrowseGroupsPage` SHALL display an error message "Failed to load groups. Please try again." within the page content area.
2. THE `BrowseGroupsPage` SHALL render a "Retry" button alongside the error message.
3. WHEN the "Retry" button is clicked, THE `BrowseGroupsPage` SHALL clear the error state and re-invoke the `API_Handler`.
4. IF the `API_Handler` error message is empty or undefined, THEN THE `BrowseGroupsPage` SHALL display the fallback message "Failed to load groups. Please try again.".

---

### Requirement 9: Accessibility

**User Story:** As a user relying on assistive technology, I want the Browse Groups page to be fully navigable and understandable, so that I can discover and interact with groups without barriers.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL use semantic HTML elements (`<main>`, `<section>`, `<article>`, `<nav>`) to structure page content.
2. THE `SearchBar` SHALL have an accessible label "Search groups" associated via `aria-label` or a visible `<label>` element.
3. THE `GroupFilters` controls SHALL have visible labels and be operable via keyboard navigation in logical tab order.
4. WHEN the `LoadingState` is active, THE `BrowseGroupsPage` SHALL set `aria-busy="true"` on the group list container.
5. WHEN the `ErrorState` or `EmptyState` is displayed, THE `BrowseGroupsPage` SHALL announce the state change to screen readers using an `aria-live="polite"` region.
6. THE `GroupCard` interactive elements (buttons, links) SHALL have descriptive `aria-label` attributes that include the group name (e.g., "View details for Savings Circle Alpha").

---

### Requirement 10: Performance

**User Story:** As a user, I want the page to remain responsive even when many groups are loaded, so that browsing does not feel slow or laggy.

#### Acceptance Criteria

1. THE `BrowseGroupsPage` SHALL apply client-side search and filter operations using `useMemo` to avoid redundant recomputation on unrelated re-renders.
2. THE `SearchBar` SHALL debounce user input by 300 milliseconds before triggering a filter update, preventing excessive re-renders during typing.
3. THE `BrowseGroupsPage` SHALL NOT re-fetch groups from the `API_Handler` on every render; the fetch SHALL be triggered only on mount and on explicit retry.
4. WHERE the group dataset exceeds 100 items, THE `BrowseGroupsPage` SHALL rely on pagination to limit the number of simultaneously rendered `GroupCard` components to the current page size.
