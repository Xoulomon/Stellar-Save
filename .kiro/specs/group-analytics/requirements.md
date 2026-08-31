# Requirements Document

## Introduction

The Group Analytics feature provides a dedicated admin view for group creators on the Stellar Save platform. It surfaces three key performance indicators — per-cycle contribution rates, on-time payment percentages, and a projected completion date — through interactive charts. Access is restricted to the group creator to protect member privacy and prevent misuse of aggregate financial data.

The frontend is built with React + TypeScript + MUI. Charts will use Recharts (to be added as a dependency). Data is derived from on-chain contribution and cycle records exposed through the existing contract client and group/contribution hooks.

## Glossary

- **Group_Analytics_Page**: The `GroupAnalytics.tsx` page component rendered at `/groups/:groupId/analytics`.
- **Group_Creator**: The wallet address stored in `GroupDetail.creator`; the only user permitted to view the analytics page.
- **Cycle**: A fixed time period (duration stored in `GroupDetail.cycleDuration` in seconds) during which members are expected to contribute.
- **Contribution_Rate**: The ratio of members who contributed in a given cycle to the total number of members in that cycle, expressed as a percentage.
- **On_Time_Payment**: A contribution recorded on-chain before the cycle deadline timestamp.
- **On_Time_Percentage**: The ratio of on-time contributions to total expected contributions across all completed cycles, expressed as a percentage.
- **Projected_Completion_Date**: The estimated calendar date when all cycles will have been completed, calculated as `startedAt + (totalCycles × cycleDuration)`.
- **Analytics_Hook**: The `useGroupAnalytics` custom React hook that fetches and computes all analytics data for a given group.
- **Auth_Guard**: The access-control check that compares the connected wallet address to `GroupDetail.creator` and redirects unauthorised users.

---

## Requirements

### Requirement 1: Access Control

**User Story:** As a group creator, I want the analytics page to be accessible only to me, so that member contribution data remains private.

#### Acceptance Criteria

1. WHEN a connected wallet address matches `GroupDetail.creator`, THE Group_Analytics_Page SHALL render the analytics content.
2. WHEN a connected wallet address does not match `GroupDetail.creator`, THE Auth_Guard SHALL redirect the user to the Group Detail page for that group.
3. WHEN no wallet is connected, THE Auth_Guard SHALL redirect the user to the home page.
4. IF the group data is still loading, THE Group_Analytics_Page SHALL display a loading skeleton and SHALL NOT redirect prematurely.

---

### Requirement 2: Per-Cycle Contribution Rate Chart

**User Story:** As a group creator, I want to see a bar chart of contribution rates per cycle, so that I can identify cycles with low participation.

#### Acceptance Criteria

1. THE Group_Analytics_Page SHALL display a bar chart rendered with Recharts showing one bar per completed cycle.
2. WHEN cycle contribution data is available, THE Analytics_Hook SHALL compute the contribution rate for each cycle as `(contributorsInCycle / totalMembersInCycle) × 100`.
3. THE bar chart SHALL label each bar with its cycle number (e.g., "Cycle 1", "Cycle 2").
4. THE bar chart SHALL display the Y-axis as a percentage from 0 to 100.
5. WHEN a user hovers over a bar, THE bar chart SHALL display a tooltip showing the cycle number, number of contributors, total members, and contribution rate percentage.
6. IF no completed cycles exist, THE Group_Analytics_Page SHALL display an empty-state message reading "No cycle data available yet."

---

### Requirement 3: On-Time Payment Percentage Display

**User Story:** As a group creator, I want to see the overall on-time payment percentage, so that I can assess group reliability.

#### Acceptance Criteria

1. THE Group_Analytics_Page SHALL display the on-time payment percentage as a numeric stat card.
2. WHEN contribution records are available, THE Analytics_Hook SHALL compute on-time percentage as `(onTimeContributions / totalExpectedContributions) × 100`, rounded to one decimal place.
3. THE stat card SHALL display the percentage value alongside a label "On-Time Payment Rate".
4. WHILE analytics data is loading, THE stat card SHALL display a skeleton placeholder.
5. IF total expected contributions is zero, THE Analytics_Hook SHALL return an on-time percentage of 0 and THE stat card SHALL display "0.0%".

---

### Requirement 4: Projected Completion Date

**User Story:** As a group creator, I want to see the projected completion date of the group, so that I can communicate the timeline to members.

#### Acceptance Criteria

1. THE Group_Analytics_Page SHALL display the projected completion date as a formatted date string (e.g., "15 Mar 2027").
2. WHEN `GroupDetail.startedAt` is not null and `GroupDetail.cycleDuration` and `GroupDetail.maxMembers` are available, THE Analytics_Hook SHALL calculate the projected completion date as `startedAt + (maxMembers × cycleDuration × 1000)` milliseconds from epoch.
3. THE projected completion date display SHALL include a label "Projected Completion".
4. IF `GroupDetail.startedAt` is null (group not yet started), THE Group_Analytics_Page SHALL display "Not started yet" in place of the date.
5. WHILE analytics data is loading, THE projected completion date display SHALL show a skeleton placeholder.

---

### Requirement 5: Analytics Data Hook

**User Story:** As a developer, I want a dedicated `useGroupAnalytics` hook, so that data-fetching and computation logic is separated from the UI.

#### Acceptance Criteria

1. THE Analytics_Hook SHALL accept a `groupId` string parameter and return `{ cycleRates, onTimePercent, projectedCompletionDate, isLoading, error }`.
2. WHEN `groupId` is null or undefined, THE Analytics_Hook SHALL return `isLoading: false` and empty/null values without making any network requests.
3. IF a data-fetching error occurs, THE Analytics_Hook SHALL set `error` to a descriptive string and SHALL NOT throw an unhandled exception.
4. THE Analytics_Hook SHALL derive `cycleRates` from the existing contribution and group data sources already used by `useGroup` and `useContributions`.
5. FOR ALL valid group data inputs, THE Analytics_Hook SHALL produce a `projectedCompletionDate` that is strictly after `GroupDetail.startedAt` (round-trip invariant: date is always in the future relative to start).

---

### Requirement 6: Page Route and Navigation

**User Story:** As a group creator, I want to navigate to the analytics page from the group detail view, so that I can access it without manually typing a URL.

#### Acceptance Criteria

1. THE Group_Analytics_Page SHALL be accessible at the route `/groups/:groupId/analytics`.
2. THE routing configuration SHALL register `/groups/:groupId/analytics` as a protected route requiring wallet connection.
3. WHEN the connected wallet is the group creator and the user is on the Group Detail page, THE Group_Analytics_Page SHALL be reachable via a clearly labelled "Analytics" link or button.
4. THE `buildRoute` helper SHALL expose a `groupAnalytics(groupId: string)` function returning `/groups/${groupId}/analytics`.
