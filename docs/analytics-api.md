# Analytics API Documentation

## Overview

The Analytics API provides aggregated statistics and insights about platform usage, user behavior, and group metrics. It includes endpoints for retrieving analytics data, recording events, generating reports, and managing cache.

**Issue:** [#558 - Backend Create analytics API](https://github.com/Xoulomon/Stellar-Save/issues/558)

## Architecture

### Components

1. **AnalyticsService** (`analytics_service.ts`)
   - Core service for fetching and generating analytics data
   - Implements caching via Redis
   - Provides methods for all analytics queries

2. **AnalyticsAggregator** (`analytics_aggregator.ts`)
   - Periodically aggregates raw events into metrics
   - Runs on a configurable interval (default: 24 hours)
   - Computes platform, user, and group metrics

3. **Analytics Middleware** (`analytics_middleware.ts`)
   - Rate limiting for API endpoints
   - HTTP response caching
   - Cache invalidation utilities

4. **Database Models** (Prisma)
   - `PlatformMetrics`: Daily platform-wide statistics
   - `UserMetrics`: Daily per-user metrics
   - `GroupMetrics`: Daily per-group metrics
   - `AnalyticsEvent`: Raw event tracking data
   - `AnalyticsReport`: Generated reports

## API Endpoints

### Platform Analytics

#### Get Platform Statistics
**Endpoint:** `GET /api/v1/analytics/platform`

Query Parameters:
- `date` (optional): ISO date string (defaults to today)

Response:
```json
{
  "totalUsers": 1000,
  "activeUsers": 750,
  "totalGroups": 150,
  "activeGroups": 120,
  "totalContributions": 5000,
  "totalContributionAmount": 50000,
  "totalPayouts": 4800,
  "totalPayoutAmount": 48000,
  "averageGroupSize": 6.67,
  "successRate": 96,
  "totalTransactions": 9800,
  "uniqueWallets": 850
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

#### Get Platform Trends
**Endpoint:** `GET /api/v1/analytics/platform/trends`

Query Parameters:
- `startDate` (required): ISO date string
- `endDate` (required): ISO date string
- `limit` (optional): Number of data points (default: 30)
- `offset` (optional): Pagination offset (default: 0)

Response:
```json
{
  "startDate": "2026-04-22T00:00:00Z",
  "endDate": "2026-04-29T00:00:00Z",
  "dataPoints": 7,
  "trends": [
    {
      "totalUsers": 1000,
      "activeUsers": 750,
      ...
    }
  ]
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

### User Analytics

#### Get User Statistics
**Endpoint:** `GET /api/v1/analytics/users/:userId`

Path Parameters:
- `userId` (required): User identifier

Query Parameters:
- `date` (optional): ISO date string (defaults to today)

Response:
```json
{
  "userId": "user-123",
  "groupsJoined": 5,
  "groupsCreated": 2,
  "groupsCompleted": 1,
  "totalContributions": 10,
  "totalContributionAmount": 500,
  "totalPayoutsReceived": 400,
  "sessionsCount": 8,
  "sessionDurationMinutes": 120,
  "pageViews": 50,
  "interactionCount": 150
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

### Group Analytics

#### Get Group Statistics
**Endpoint:** `GET /api/v1/analytics/groups/:groupId`

Path Parameters:
- `groupId` (required): Group identifier

Query Parameters:
- `date` (optional): ISO date string (defaults to today)

Response:
```json
{
  "groupId": "group-123",
  "memberCount": 10,
  "totalContributions": 50,
  "totalContributionAmount": 2500,
  "totalPayoutsDistributed": 2000,
  "successRate": 90,
  "averageContributionSize": 50,
  "newMembersCount": 3,
  "churnCount": 1
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

### Event Analytics

#### Get Event Statistics
**Endpoint:** `GET /api/v1/analytics/events`

Query Parameters:
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `limit` (optional): Number of events (default: 20)
- `offset` (optional): Pagination offset (default: 0)

Response:
```json
{
  "count": 3,
  "events": [
    {
      "eventType": "page_view",
      "eventName": "dashboard_view",
      "count": 1500,
      "lastOccurred": "2026-04-29T10:30:00Z"
    },
    {
      "eventType": "transaction",
      "eventName": "contribution",
      "count": 850,
      "lastOccurred": "2026-04-29T09:15:00Z"
    }
  ]
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

#### Record New Event
**Endpoint:** `POST /api/v1/analytics/events`

Request Body:
```json
{
  "eventType": "transaction",
  "eventName": "contribution_completed",
  "userId": "user-123",
  "groupId": "group-456",
  "eventData": {
    "amount": 500,
    "currency": "USDC"
  },
  "sessionId": "session-789"
}
```

Response:
```json
{
  "message": "Event recorded successfully"
}
```

Rate Limit: 50 requests/minute (IP), 100 requests/minute (authenticated)

Required Fields:
- `eventType`: Type of event
- `eventName`: Name of the specific event

Optional Fields:
- `userId`: User identifier
- `groupId`: Group identifier
- `eventData`: Additional event metadata
- `sessionId`: Session identifier

---

### Reports

#### Generate Report
**Endpoint:** `POST /api/v1/analytics/reports`

Request Body:
```json
{
  "reportType": "weekly",
  "reportName": "Weekly Platform Report - Week 17",
  "startDate": "2026-04-22T00:00:00Z",
  "endDate": "2026-04-29T00:00:00Z",
  "generatedBy": "admin-123"
}
```

Response:
```json
{
  "reportType": "weekly",
  "reportName": "Weekly Platform Report - Week 17",
  "startDate": "2026-04-22T00:00:00Z",
  "endDate": "2026-04-29T00:00:00Z",
  "data": {
    "summary": {
      "startDate": "2026-04-22T00:00:00Z",
      "endDate": "2026-04-29T00:00:00Z",
      "metricsCount": 7,
      "topEvents": [...]
    },
    "platformMetrics": [...],
    "statistics": {
      "avgUsers": 995,
      "avgGroups": 148,
      "totalContributions": 35000,
      "totalRevenue": 350000
    }
  },
  "generatedAt": "2026-04-29T12:00:00Z"
}
```

Rate Limit: 50 requests/minute (IP), 100 requests/minute (authenticated)

Required Fields:
- `reportType`: Type of report (daily, weekly, monthly, custom)
- `reportName`: Name of the report
- `startDate`: Report start date
- `endDate`: Report end date

Optional Fields:
- `generatedBy`: User ID who generated the report

---

#### Get Reports
**Endpoint:** `GET /api/v1/analytics/reports`

Query Parameters:
- `reportType` (optional): Filter by report type
- `limit` (optional): Number of reports (default: 20)
- `offset` (optional): Pagination offset (default: 0)

Response:
```json
{
  "count": 2,
  "reports": [
    {
      "reportType": "weekly",
      "reportName": "Weekly Platform Report - Week 17",
      "startDate": "2026-04-22T00:00:00Z",
      "endDate": "2026-04-29T00:00:00Z",
      "data": {...},
      "generatedAt": "2026-04-29T12:00:00Z"
    }
  ]
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)
Cache: 1 hour

---

### Cache Management

#### Get Cache Statistics
**Endpoint:** `GET /api/v1/analytics/cache/stats`

Response:
```json
{
  "hits": 1500,
  "misses": 300,
  "hitRate": 83.33,
  "connected": true
}
```

Rate Limit: 300 requests/minute (IP), 600 requests/minute (authenticated)

---

#### Clear Cache
**Endpoint:** `POST /api/v1/analytics/cache/clear`

Request Body:
```json
{
  "pattern": "*"
}
```

Response:
```json
{
  "message": "Cache cleared successfully"
}
```

Rate Limit: 50 requests/minute (IP), 100 requests/minute (authenticated)

Query Parameters:
- `pattern` (optional): Cache key pattern to clear (default: "*")

---

## Event Types

Common event types that should be tracked:

- `page_view`: User viewed a page
- `click`: User clicked a button or link
- `transaction`: Financial transaction occurred
  - Subtypes via `eventData.type`: `contribution`, `payout`
- `join_group`: User joined a group
- `leave_group`: User left a group
- `create_group`: User created a new group
- `group_completed`: Group completed its cycle
- `group_activity`: Activity in a group
- `member_joined`: New member joined
- `member_left`: Member left group

---

## Rate Limiting

The Analytics API implements tiered rate limiting:

### Read Operations (GET)
- **Unauthenticated (IP-based)**: 300 requests/minute
- **Authenticated (User-based)**: 600 requests/minute

### Write Operations (POST)
- **Unauthenticated (IP-based)**: 50 requests/minute
- **Authenticated (User-based)**: 100 requests/minute

Response Headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying (on 429)

---

## Caching

The Analytics API implements a 1-hour HTTP response cache for GET requests:

- Cache decisions are made per-endpoint
- Cache key includes the full URL
- Cache hits include `X-Cache: HIT` header
- Cache misses include `X-Cache: MISS` header

### Cache Invalidation

Caches are automatically invalidated:
- When new metrics are aggregated
- When events are recorded
- When reports are generated
- Via manual cache clear endpoint

---

## Data Aggregation

The `AnalyticsAggregator` periodically aggregates raw events into metrics:

### Default Behavior
- Runs daily (24-hour interval)
- Aggregates data for the previous day
- Starts automatically when the aggregator is initialized

### Configuration

```typescript
const aggregator = new AnalyticsAggregator(prisma, intervalMs);
aggregator.start();  // Begin periodic aggregation
aggregator.stop();   // Stop periodic aggregation
await aggregator.runAggregation(); // Run manually
```

### Aggregation Process

1. **Platform Metrics**: Counts active users/groups, total contributions/payouts
2. **User Metrics**: Per-user session counts, contribution totals, payout received
3. **Group Metrics**: Member counts, contribution totals, success rates, churn

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK`: Successful GET request
- `201 Created`: Successful POST request
- `400 Bad Request`: Missing required parameters
- `404 Not Found`: Resource not found (e.g., user/group has no analytics)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side error

Error Response:
```json
{
  "error": "Description of the error"
}
```

---

## Integration

### Initialize Analytics Service

```typescript
import { PrismaClient } from '@prisma/client';
import { AnalyticsService } from './analytics_service';
import { AnalyticsAggregator } from './analytics_aggregator';

const prisma = new PrismaClient();
const analyticsService = new AnalyticsService(prisma);
const aggregator = new AnalyticsAggregator(prisma);

aggregator.start(); // Start periodic aggregation

// Add to V1 services
const v1Services = {
  // ... other services
  analyticsService,
};
```

### Record Events from Application

```typescript
// Record a purchase event
await analyticsService.recordEvent(
  'transaction',
  'contribution',
  userId,
  groupId,
  { amount: 500, currency: 'USDC' },
  sessionId
);

// Record a page view
await analyticsService.recordEvent(
  'page_view',
  'dashboard',
  userId,
  undefined,
  undefined,
  sessionId
);
```

---

## Performance Considerations

- **Caching**: HTTP response caching reduces database queries by ~80% in typical usage
- **Indexing**: Database queries are optimized with strategic indexes on date, user, and group fields
- **Aggregation**: Daily aggregation runs in background; raw events are preserved for 90 days
- **Rate Limiting**: Prevents abuse and ensures fair resource allocation

---

## Testing

Run the analytics test suite:

```bash
npm test -- analytics.test.ts
```

Tests cover:
- Event recording
- Platform/user/group statistics retrieval
- Report generation
- Trend analysis
- Cache operations
- Aggregation behavior

---

## Future Enhancements

- Advanced filtering and query builders
- Custom metric definitions
- Real-time event streaming
- Machine learning-based anomaly detection
- Export analytics in multiple formats (CSV, PDF)
- Webhook notifications for metric thresholds
- Performance metrics and benchmarking
