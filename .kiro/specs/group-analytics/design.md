# Design Document: Group Analytics

## Overview

The Group Analytics feature adds a creator-only analytics page at `/groups/:groupId/analytics`. It surfaces three key metrics for a group creator: a per-cycle contribution rate bar chart, an on-time payment percentage stat card, and a projected completion date display. All data is derived from the existing `useGroup` and `useContributions` hooks — no new backend endpoints are required.

The frontend stack is React 19 + TypeScript + MUI v7. Charts are rendered with **Recharts**, which must be added as a new dependency. Property-based tests use **fast-check**, which is already present in `devDependencies`.

### Key Design Decisions

- **No new API layer.** `useGroupAnalytics` composes `useGroup` and `useContributions` internally, keeping the analytics page thin.
- **Creator-only guard at the page level.** The existing `ProtectedRoute` handles wallet-connection checks; a second, group-specific `AuthGuard` component handles creator-identity checks and redirects.
- **Recharts over MUI Charts.** Recharts is the library named in the requirements and is a well-maintained, React-native charting library that integrates cleanly with MUI layouts.
- **Computation in the hook, not the component.** `useGroupAnalytics` owns all arithmetic (cycle rates, on-time %, projected date) so the page component stays declarative.

---

## Architecture

```mermaid
graph TD
    subgraph Routing
        R1["/groups/:groupId/analytics<br/>(protected route)"]
    end

    subgraph Pages
        P1[GroupAnalyticsPage]
    end

    subgraph Guards
        G1[AuthGuard<br/>(creator check)]
    end

    subgraph Hooks
        H1[useGroupAnalytics]
        H2[useGroup]
        H3[useContributions]
        H4[useWallet]
    end

    subgraph Components
        C1[CycleContributionChart]
        C2[OnTimePaymentCard]
        C3[ProjectedCompletionCard]
    end

    subgraph Data
        D1[groupApi.fetchGroup]
    end

    R1 --> P1
    P1 --> G1
    G1 -->|authorized| H1
    G1 -->|unauthorized| redirect
    H1 --> H2
    H1 --> H3
    H2 --> D1
    H3 --> D1
    H4 --> G1
    H1 --> C1
    H1 --> C2
    H1 --> C3
```

The page is registered as a standard protected route (wallet-connection guard). Once inside, `AuthGuard` performs the creator-identity check. `useGroupAnalytics` composes the two existing data hooks and derives the three analytics values.

---

## Components and Interfaces

### `GroupAnalyticsPage` (`frontend/src/pages/GroupAnalyticsPage.tsx`)

Top-level page component. Reads `groupId` from route params, delegates auth to `AuthGuard`, and renders the three metric components.

```tsx
export default function GroupAnalyticsPage(): JSX.Element
```

Responsibilities:
- Extract `groupId` from `useNavigation().params`
- Render `AuthGuard` wrapping the analytics content
- Render loading skeletons while `isLoading` is true
- Render empty-state message when no cycle data exists

---

### `AuthGuard` (`frontend/src/components/AuthGuard.tsx`)

Reusable component that enforces creator-only access. Wraps any children and redirects if the connected wallet is not the group creator.

```tsx
interface AuthGuardProps {
  groupId: string;
  children: React.ReactNode;
}

export function AuthGuard({ groupId, children }: AuthGuardProps): JSX.Element | null
```

Redirect logic:
| Condition | Redirect target |
|---|---|
| No wallet connected | `/` (home) |
| Group still loading | Render skeleton, no redirect |
| Wallet ≠ `group.creator` | `/groups/:groupId` |
| Wallet = `group.creator` | Render `children` |

---

### `CycleContributionChart` (`frontend/src/components/CycleContributionChart.tsx`)

Recharts `BarChart` showing one bar per completed cycle. Y-axis is 0–100 (percentage). Tooltip shows cycle number, contributors, total members, and rate.

```tsx
interface CycleRate {
  cycleNumber: number;
  contributorsInCycle: number;
  totalMembersInCycle: number;
  rate: number; // 0–100
}

interface CycleContributionChartProps {
  data: CycleRate[];
}

export function CycleContributionChart({ data }: CycleContributionChartProps): JSX.Element
```

---

### `OnTimePaymentCard` (`frontend/src/components/OnTimePaymentCard.tsx`)

MUI `Card` displaying the on-time payment percentage as a large numeric stat.

```tsx
interface OnTimePaymentCardProps {
  percent: number | null; // null while loading
  isLoading: boolean;
}

export function OnTimePaymentCard({ percent, isLoading }: OnTimePaymentCardProps): JSX.Element
```

---

### `ProjectedCompletionCard` (`frontend/src/components/ProjectedCompletionCard.tsx`)

MUI `Card` displaying the projected completion date as a formatted string.

```tsx
interface ProjectedCompletionCardProps {
  date: Date | null;   // null = not started or loading
  isLoading: boolean;
  notStarted: boolean; // true when startedAt is null
}

export function ProjectedCompletionCard({ date, isLoading, notStarted }: ProjectedCompletionCardProps): JSX.Element
```

---

## Data Models

### `CycleRate`

Represents the contribution rate for a single completed cycle.

```ts
interface CycleRate {
  cycleNumber: number;
  contributorsInCycle: number;
  totalMembersInCycle: number;
  /** Percentage 0–100, rounded to one decimal place */
  rate: number;
}
```

### `GroupAnalyticsResult`

Return type of `useGroupAnalytics`.

```ts
interface GroupAnalyticsResult {
  /** Per-cycle contribution rates for all completed cycles */
  cycleRates: CycleRate[];
  /** On-time payment percentage (0–100), null while loading */
  onTimePercent: number | null;
  /** Projected completion date, null if group not started */
  projectedCompletionDate: Date | null;
  isLoading: boolean;
  error: string | null;
}
```

### `useGroupAnalytics` hook

```ts
function useGroupAnalytics(groupId: string | null | undefined): GroupAnalyticsResult
```

**Computation rules:**

1. **`cycleRates`** — For each `GroupCycle` with `status === 'completed'`, count the `GroupContribution` records whose `status === 'completed'` and whose timestamp falls within `[cycle.startDate, cycle.endDate]`. Divide by `group.maxMembers` × 100.

2. **`onTimePercent`** — Count contributions where `timestamp < cycle.endDate` (on-time) across all completed cycles. Divide by `(completedCycles.length × group.maxMembers)` × 100, rounded to one decimal. Return `0` when denominator is zero.

3. **`projectedCompletionDate`** — When `group.startedAt` is not null: `new Date(group.startedAt.getTime() + group.maxMembers * group.cycleDuration * 1000)`.

### Route constants additions

```ts
// frontend/src/routing/constants.ts additions
GROUP_ANALYTICS: "/groups/:groupId/analytics"

// buildRoute additions
groupAnalytics: (groupId: string) => `/groups/${groupId}/analytics`
```

---

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Creator wallet sees analytics content

*For any* group and any wallet address that equals `group.creator`, rendering `AuthGuard` with that wallet connected should render the analytics children rather than redirecting.

**Validates: Requirements 1.1**

---

### Property 2: Non-creator wallet is redirected

*For any* group and any wallet address that does not equal `group.creator`, rendering `AuthGuard` should trigger a redirect to the group detail page rather than rendering the analytics children.

**Validates: Requirements 1.2**

---

### Property 3: Chart has one bar per completed cycle

*For any* array of `CycleRate` data with N entries, `CycleContributionChart` should render exactly N bars.

**Validates: Requirements 2.1**

---

### Property 4: Cycle rate formula is correct

*For any* pair of non-negative integers `(contributorsInCycle, totalMembersInCycle)` where `totalMembersInCycle > 0`, `useGroupAnalytics` should compute `rate = (contributorsInCycle / totalMembersInCycle) × 100`.

**Validates: Requirements 2.2**

---

### Property 5: Bar labels match cycle numbers

*For any* array of `CycleRate` data, every bar rendered by `CycleContributionChart` should be labelled "Cycle N" where N is the corresponding `cycleNumber`.

**Validates: Requirements 2.3**

---

### Property 6: Tooltip contains all required fields

*For any* `CycleRate` data point, the tooltip rendered by `CycleContributionChart` for that bar should contain the cycle number, number of contributors, total members, and contribution rate percentage.

**Validates: Requirements 2.5**

---

### Property 7: On-time stat card renders value and label

*For any* numeric `onTimePercent` value in [0, 100], `OnTimePaymentCard` should render both the numeric percentage and the label "On-Time Payment Rate".

**Validates: Requirements 3.1, 3.3**

---

### Property 8: On-time percentage formula is correct

*For any* pair of non-negative integers `(onTimeContributions, totalExpectedContributions)` where `totalExpectedContributions > 0`, `useGroupAnalytics` should compute `onTimePercent = round((onTimeContributions / totalExpectedContributions) × 100, 1)`.

**Validates: Requirements 3.2**

---

### Property 9: Projected completion display renders date and label

*For any* non-null `Date` value, `ProjectedCompletionCard` should render both a formatted date string and the label "Projected Completion".

**Validates: Requirements 4.1, 4.3**

---

### Property 10: Projected completion date formula is correct

*For any* group with `startedAt` not null, positive `maxMembers`, and positive `cycleDuration`, `useGroupAnalytics` should compute `projectedCompletionDate = new Date(startedAt.getTime() + maxMembers × cycleDuration × 1000)`.

**Validates: Requirements 4.2**

---

### Property 11: Projected completion date is always after start

*For any* group with `startedAt` not null, positive `maxMembers`, and positive `cycleDuration`, the `projectedCompletionDate` returned by `useGroupAnalytics` must be strictly greater than `startedAt`.

**Validates: Requirements 5.5**

---

### Property 12: Hook error state is a non-empty string, never throws

*For any* data-fetching error condition, `useGroupAnalytics` should set `error` to a non-empty string and should not propagate an unhandled exception.

**Validates: Requirements 5.3**

---

### Property 13: Analytics link visible to creator on Group Detail page

*For any* group where the connected wallet equals `group.creator`, the Group Detail page should render a link or button labelled "Analytics".

**Validates: Requirements 6.3**

---

### Property 14: `buildRoute.groupAnalytics` returns correct path

*For any* non-empty `groupId` string, `buildRoute.groupAnalytics(groupId)` should return exactly `/groups/${groupId}/analytics`.

**Validates: Requirements 6.4**

---

## Error Handling

### Data fetching errors

`useGroupAnalytics` catches all errors from `useGroup` and `useContributions` and surfaces them via the `error` field. The hook never throws. The page renders an `Alert` component when `error` is non-null.

### Auth guard edge cases

- **Group not found** (fetchGroup returns null): `AuthGuard` treats this as still-loading until the error state is set, then renders an error message rather than redirecting.
- **Wallet disconnected mid-session**: `useWallet` status changes to non-`connected`; `AuthGuard` re-evaluates and redirects to home.

### Computation edge cases

| Scenario | Behaviour |
|---|---|
| `totalMembersInCycle === 0` | `rate` is returned as `0` (guard against division by zero) |
| `totalExpectedContributions === 0` | `onTimePercent` is returned as `0` |
| `startedAt === null` | `projectedCompletionDate` is returned as `null`; page shows "Not started yet" |
| `cycleRates` is empty | Page shows "No cycle data available yet" empty state |

### Loading states

All three metric components accept an `isLoading` prop and render MUI `Skeleton` placeholders while data is in flight. `AuthGuard` also renders a skeleton while group data is loading to prevent premature redirects.

---

## Testing Strategy

### Dual testing approach

Both unit tests and property-based tests are required. Unit tests cover specific examples, edge cases, and integration points. Property tests verify universal correctness across many generated inputs.

### Unit tests (Vitest + React Testing Library)

Focus areas:
- `AuthGuard`: no-wallet redirect (example), non-creator redirect (example), loading skeleton (example)
- `CycleContributionChart`: empty data empty-state (example), Y-axis domain [0, 100] (example)
- `OnTimePaymentCard`: loading skeleton (example), zero percent display "0.0%" (example)
- `ProjectedCompletionCard`: null date shows "Not started yet" (example), loading skeleton (example)
- `useGroupAnalytics`: null groupId returns empty state without fetching (example), route registration (example)
- Routing: `/groups/:groupId/analytics` is registered as a protected route (example)

### Property-based tests (fast-check, already in devDependencies)

Each property test runs a minimum of **100 iterations**. Each test is tagged with a comment in the format:

```
// Feature: group-analytics, Property N: <property text>
```

| Property | Test description | fast-check arbitraries |
|---|---|---|
| P1 | Creator wallet renders children | `fc.record({ creator: fc.string(), ... })` with wallet = creator |
| P2 | Non-creator wallet redirects | wallet ≠ creator via `fc.string().filter(s => s !== creator)` |
| P3 | Chart bar count = cycle count | `fc.array(cycleRateArb)` |
| P4 | Cycle rate formula | `fc.integer({ min: 0 }), fc.integer({ min: 1 })` |
| P5 | Bar labels match cycle numbers | `fc.array(cycleRateArb, { minLength: 1 })` |
| P6 | Tooltip contains all fields | `cycleRateArb` |
| P7 | Stat card renders value and label | `fc.float({ min: 0, max: 100 })` |
| P8 | On-time formula | `fc.integer({ min: 0 }), fc.integer({ min: 1 })` |
| P9 | Date display renders date and label | `fc.date()` |
| P10 | Projected date formula | `fc.date(), fc.integer({ min: 1 }), fc.integer({ min: 1 })` |
| P11 | Projected date > startedAt | same as P10 |
| P12 | Error state is string, no throw | mock fetch rejecting with `fc.string()` |
| P13 | Analytics link visible to creator | `fc.record({ creator: fc.string() })` with wallet = creator |
| P14 | `buildRoute.groupAnalytics` path | `fc.string({ minLength: 1 })` |

Properties P10 and P11 share the same arbitraries and can be combined into a single test that asserts both the formula and the invariant.

### Test file locations

- Unit + property tests for the hook: `frontend/src/test/useGroupAnalytics.test.ts`
- Unit + property tests for components: `frontend/src/test/GroupAnalyticsPage.test.tsx`
- Route registration example: `frontend/src/test/routing.test.ts` (extend existing file)
