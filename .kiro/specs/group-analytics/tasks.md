# Implementation Plan: Group Analytics

## Overview

Implement a creator-only analytics page at `/groups/:groupId/analytics` with a per-cycle contribution rate bar chart, on-time payment stat card, and projected completion date card. Data is derived from existing hooks; Recharts is added as a new dependency.

## Tasks

- [x] 1. Add Recharts dependency and define shared types
  - Install `recharts` as a production dependency in `frontend/`
  - Create `frontend/src/types/analytics.ts` with `CycleRate` and `GroupAnalyticsResult` interfaces
  - _Requirements: 2.1, 5.1_

- [-] 2. Implement `useGroupAnalytics` hook
  - [ ] 2.1 Create `frontend/src/hooks/useGroupAnalytics.ts`
    - Accept `groupId: string | null | undefined`; return `GroupAnalyticsResult`
    - Compose `useGroup` and `useContributions`; guard against null/undefined groupId (no fetch)
    - Compute `cycleRates`, `onTimePercent`, `projectedCompletionDate` per design computation rules
    - Catch all errors and surface via `error` field; never throw
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 3.2, 4.2_

  - [ ]* 2.2 Write property test for cycle rate formula (Property 4)
    - **Property 4: Cycle rate formula is correct**
    - **Validates: Requirements 2.2**

  - [ ]* 2.3 Write property test for on-time percentage formula (Property 8)
    - **Property 8: On-time percentage formula is correct**
    - **Validates: Requirements 3.2**

  - [ ]* 2.4 Write property tests for projected completion date (Properties 10 & 11)
    - **Property 10: Projected completion date formula is correct**
    - **Property 11: Projected completion date is always after start**
    - **Validates: Requirements 4.2, 5.5**

  - [ ]* 2.5 Write property test for hook error state (Property 12)
    - **Property 12: Hook error state is a non-empty string, never throws**
    - **Validates: Requirements 5.3**

  - [ ]* 2.6 Write unit tests for `useGroupAnalytics`
    - Test null groupId returns empty state without fetching
    - Test zero denominator edge cases (rate = 0, onTimePercent = 0)
    - Test null startedAt returns null projectedCompletionDate
    - _Requirements: 5.2, 3.5, 4.4_

- [ ] 3. Checkpoint — Ensure all hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement analytics UI components
  - [ ] 4.1 Create `frontend/src/components/CycleContributionChart.tsx`
    - Render a Recharts `BarChart` with one bar per `CycleRate` entry
    - Y-axis domain `[0, 100]`, X-axis labels "Cycle N"
    - Custom tooltip showing cycle number, contributors, total members, and rate
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test for chart bar count (Property 3)
    - **Property 3: Chart has one bar per completed cycle**
    - **Validates: Requirements 2.1**

  - [ ]* 4.3 Write property test for bar labels (Property 5)
    - **Property 5: Bar labels match cycle numbers**
    - **Validates: Requirements 2.3**

  - [ ]* 4.4 Write property test for tooltip fields (Property 6)
    - **Property 6: Tooltip contains all required fields**
    - **Validates: Requirements 2.5**

  - [ ] 4.5 Create `frontend/src/components/OnTimePaymentCard.tsx`
    - MUI `Card` displaying `percent` as a large stat with label "On-Time Payment Rate"
    - Show MUI `Skeleton` while `isLoading` is true
    - Display "0.0%" when percent is 0
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [ ]* 4.6 Write property test for `OnTimePaymentCard` (Property 7)
    - **Property 7: Stat card renders value and label**
    - **Validates: Requirements 3.1, 3.3**

  - [ ] 4.7 Create `frontend/src/components/ProjectedCompletionCard.tsx`
    - MUI `Card` displaying formatted date string with label "Projected Completion"
    - Show "Not started yet" when `notStarted` is true
    - Show MUI `Skeleton` while `isLoading` is true
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [ ]* 4.8 Write property test for `ProjectedCompletionCard` (Property 9)
    - **Property 9: Projected completion display renders date and label**
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 4.9 Write unit tests for UI components
    - `CycleContributionChart`: empty data renders empty-state message "No cycle data available yet"
    - `OnTimePaymentCard`: loading skeleton renders, zero percent shows "0.0%"
    - `ProjectedCompletionCard`: null date with notStarted shows "Not started yet", loading skeleton renders
    - _Requirements: 2.6, 3.4, 3.5, 4.4, 4.5_

- [ ] 5. Implement `AuthGuard` component
  - [ ] 5.1 Create `frontend/src/components/AuthGuard.tsx`
    - Accept `groupId` and `children`; use `useWallet` and `useGroup` internally
    - Redirect to `/` when no wallet connected
    - Render skeleton while group data is loading
    - Redirect to `/groups/:groupId` when wallet ≠ `group.creator`
    - Render `children` when wallet = `group.creator`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 5.2 Write property test for creator access (Property 1)
    - **Property 1: Creator wallet sees analytics content**
    - **Validates: Requirements 1.1**

  - [ ]* 5.3 Write property test for non-creator redirect (Property 2)
    - **Property 2: Non-creator wallet is redirected**
    - **Validates: Requirements 1.2**

  - [ ]* 5.4 Write unit tests for `AuthGuard`
    - No wallet connected → redirect to home
    - Non-creator wallet → redirect to group detail
    - Group loading → render skeleton, no redirect
    - _Requirements: 1.2, 1.3, 1.4_

- [ ] 6. Implement `GroupAnalyticsPage` and register route
  - [ ] 6.1 Create `frontend/src/pages/GroupAnalyticsPage.tsx`
    - Read `groupId` from route params
    - Wrap content in `AuthGuard`
    - Call `useGroupAnalytics(groupId)` and pass results to the three metric components
    - Render loading skeletons while `isLoading` is true
    - Render empty-state "No cycle data available yet" when `cycleRates` is empty
    - Render MUI `Alert` when `error` is non-null
    - _Requirements: 1.4, 2.6, 3.4, 4.4, 4.5, 5.3_

  - [ ] 6.2 Add route constant and `buildRoute` helper
    - Add `GROUP_ANALYTICS: "/groups/:groupId/analytics"` to `frontend/src/routing/constants.ts`
    - Add `groupAnalytics: (groupId: string) => \`/groups/${groupId}/analytics\`` to `buildRoute`
    - Register `/groups/:groupId/analytics` as a protected route in the router configuration
    - _Requirements: 6.1, 6.2, 6.4_

  - [ ]* 6.3 Write property test for `buildRoute.groupAnalytics` (Property 14)
    - **Property 14: `buildRoute.groupAnalytics` returns correct path**
    - **Validates: Requirements 6.4**

  - [ ]* 6.4 Write route registration unit test
    - Verify `/groups/:groupId/analytics` is registered as a protected route
    - _Requirements: 6.1, 6.2_

- [ ] 7. Add "Analytics" link to Group Detail page
  - [ ] 7.1 Modify the Group Detail page component to render an "Analytics" link/button
    - Show the link only when the connected wallet equals `group.creator`
    - Use `buildRoute.groupAnalytics(groupId)` for the href
    - _Requirements: 6.3_

  - [ ]* 7.2 Write property test for analytics link visibility (Property 13)
    - **Property 13: Analytics link visible to creator on Group Detail page**
    - **Validates: Requirements 6.3**

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` (already in devDependencies); run with `vitest --run`
- Test files: `frontend/src/test/useGroupAnalytics.test.ts`, `frontend/src/test/GroupAnalyticsPage.test.tsx`, `frontend/src/test/routing.test.ts`
- Each property test must include the comment `// Feature: group-analytics, Property N: <property text>`
