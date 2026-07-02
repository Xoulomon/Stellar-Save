# Funnel & Cohort Analytics
<!-- Closes #1172 -->

Track user pathways through key ROSCA funnel stages and analyze cohort retention patterns.

## Critical User Journey Funnels

### Primary ROSCA Funnel

```
Wallet Connected
    → Group Discovered  (browse/search)
    → Group Joined
    → First Contribution Made
    → Payout Received
    → Second Group Joined  (retention signal)
```

### Secondary Funnels

| Funnel | Stages |
|--------|--------|
| **Onboarding** | Landing → Wallet Connect → First Group Join |
| **Contribution** | Cycle Start → Reminder Seen → Contribution Submitted → Confirmed |
| **Re-engagement** | Inactive (7d) → Notification → Return Visit → Action |

---

## Cohort Tracking Infrastructure

### Event Schema

Every tracked event is emitted as a structured log:

```typescript
interface FunnelEvent {
  event: string;          // e.g. "group_joined"
  user_id: string;        // hashed wallet address (SHA-256, first 16 bytes)
  group_id?: string;
  timestamp: number;      // Unix ms
  properties: Record<string, string | number | boolean>;
}
```

### Event Inventory

| Event Name | Trigger | Key Properties |
|-----------|---------|----------------|
| `wallet_connected` | Freighter/Albedo auth | `wallet_type` |
| `group_viewed` | Group detail page load | `group_id`, `members_count` |
| `group_joined` | `join_group` tx confirmed | `group_id`, `contribution_amount` |
| `contribution_submitted` | `contribute` tx confirmed | `group_id`, `cycle_number` |
| `payout_received` | Payout tx detected | `group_id`, `amount_xlm` |
| `group_completed` | `is_complete` → true | `group_id`, `total_cycles` |

### Cohort Definition

Users are bucketed by **calendar week of first `wallet_connected`** event.

```typescript
// Cohort assignment (runs once per user)
function getCohortWeek(firstSeenTs: number): string {
  const d = new Date(firstSeenTs);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.valueOf() - startOfYear.valueOf()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
```

### Retention Matrix

Weeks since first event (columns) × cohort week (rows). Each cell = % of cohort that performed any `contribution_submitted` that week.

---

## Funnel Analysis Dashboard

### Panels

1. **Funnel Drop-off** — horizontal bar chart showing conversion % between each stage; absolute counts on hover.
2. **Cohort Retention Grid** — heatmap; dark = high retention; exportable as CSV.
3. **Stage Time Distribution** — median & p95 time between stages per cohort.
4. **Funnel by Segment** — toggle to overlay any segmentation attribute (see below).

### Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Event ingestion | PostHog (self-hosted) or Plausible | Open-source, GDPR-friendly |
| Storage | ClickHouse (append-only events table) | Fast aggregation at scale |
| Dashboard | Grafana or Metabase | SQL-driven, no vendor lock-in |
| SDK | PostHog JS `posthog-js` | Auto-captures page events; manual `capture()` for tx events |

### Minimal Instrumentation Hook (TypeScript/React)

```typescript
// analytics.ts
import posthog from 'posthog-js';

export function track(event: string, props: Record<string, unknown> = {}) {
  posthog.capture(event, props);
}

// Usage after a confirmed transaction:
track('contribution_submitted', {
  group_id: groupId,
  cycle_number: cycle,
  amount_xlm: amountXlm,
});
```

---

## Segmentation by User Attributes

Supported dimensions for every funnel/cohort query:

| Attribute | Source | Values |
|-----------|--------|--------|
| `wallet_type` | Auth event | `freighter`, `albedo`, `xbull` |
| `group_size` | Group state | `2-5`, `6-10`, `11-20` |
| `contribution_tier` | Contribution amount (XLM) | `<10`, `10-50`, `50-100`, `>100` |
| `region` | IP geolocation (country only) | ISO 3166-1 alpha-2 |
| `platform` | User-agent | `web`, `mobile-web` |

### Privacy Constraints

- Wallet addresses are **one-way hashed** before storage; never stored in plaintext.
- No PII beyond country-level geolocation.
- Users can opt out via a `do_not_track` flag stored in localStorage; events are suppressed client-side.
- Retention: raw events purged after 365 days; aggregated cohort tables kept indefinitely.
