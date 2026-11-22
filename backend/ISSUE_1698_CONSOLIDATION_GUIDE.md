# Issue #1698: Pagination Consolidation Guide

## Overview

This guide documents the consolidated pagination approach for the backend. The shared pagination utility in `backend/src/lib/pagination.ts` is the single source of truth for all pagination logic across REST and GraphQL endpoints.

---

## Single Source of Truth

**File**: `backend/src/lib/pagination.ts`

This module provides:

- Parameter parsing and validation
- Result envelope builders
- In-memory array pagination helpers
- Consistent defaults and limits

All endpoints **MUST** use functions from this module for pagination.

---

## Consolidation Strategy

### 1. REST Endpoints (v1, v2)

**Pattern**: Use `parseOffsetParams()` + `paginate()` or `paginateArray()`

#### Before (Inconsistent)

```typescript
// v1.ts - GOOD (already using utility)
const pageParams = parseOffsetParams(req.query, { limit: 20 });
const allJobs = backupService.listJobs();
const jobs = paginateArray(allJobs, pageParams);
res.json(paginate(jobs, allJobs.length, pageParams));

// v2.ts - BAD (manual, inconsistent)
const page = Math.max(1, parseInt(req.query.page as string) || 1);
const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
const offset = (page - 1) * limit;
// Manual slicing, no validation
```

#### After (Consolidated)

```typescript
// v1.ts - Keep as-is (already correct)
const pageParams = parseOffsetParams(req.query, { limit: 20 });
const allJobs = backupService.listJobs();
res.json(paginateArray(allJobs, pageParams));

// v2.ts - Migrate to use shared utility
const pageParams = parseOffsetParams(req.query, { limit: 20 });
const allJobs = backupService.listJobs();
res.json(paginateArray(allJobs, pageParams));
```

**Benefits**:

- ✅ Consistent parameter parsing
- ✅ Automatic validation and clamping
- ✅ Standard response envelope with metadata
- ✅ Single point of maintenance

---

### 2. GraphQL Resolvers

**Pattern**: Use `paginateArray()` or `paginateCursorArray()` to get full envelope

#### Before (Inconsistent - no metadata)

```typescript
// graphql/resolvers/shared.ts
export const paginateResults = (items: any[], limit?: number, offset?: number): any[] => {
  if (!limit && !offset) return items;
  const pageParams = { limit: limit ?? 20, offset: offset ?? 0 };
  const safeOffset = Math.min(pageParams.offset, items.length);
  return items.slice(safeOffset, safeOffset + pageParams.limit);
};

// graphql/resolvers/groups.ts - Returns only sliced array
groups: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) =>
  paginateResults(mockGroups, limit, offset),
```

#### After (Consolidated - with metadata)

```typescript
// graphql/resolvers/groups.ts - Returns full envelope
import { paginateArray, parseOffsetParams, type OffsetParams } from '../../lib/pagination';

groups: (_: unknown, args: { limit?: number; offset?: number }) => {
  const params: OffsetParams = {
    limit: Math.min(100, Math.max(1, args.limit ?? 20)),
    offset: Math.max(0, args.offset ?? 0),
  };
  return paginateArray(mockGroups, params);
},
```

**GraphQL Schema Update**:

```graphql
type Query {
  groups(limit: Int, offset: Int): GroupsPaginatedResult!
}

type GroupsPaginatedResult {
  data: [Group!]!
  pagination: PaginationInfo!
}

type PaginationInfo {
  limit: Int!
  offset: Int!
  total: Int!
  hasMore: Boolean!
}
```

**Benefits**:

- ✅ Clients can know total items and hasMore
- ✅ Consistent with REST endpoints
- ✅ Maximum page size enforced (100)
- ✅ Proper metadata for pagination UI

---

### 3. New Pagination Features

#### Search Endpoints

**Before**: Returns full result set

```typescript
router.get('/search', validateQuery(schemas.searchQuery), async (req: any, res, next) => {
  const { q } = req.validatedQuery;
  const results = await searchService.globalSearch(q);
  res.json(results); // No pagination!
});
```

**After**: Add pagination

```typescript
router.get('/search', validateQuery(schemas.searchQuery), async (req: any, res, next) => {
  const { q } = req.validatedQuery;
  const pageParams = parseOffsetParams(req.query);
  const allResults = await searchService.globalSearch(q);
  res.json(paginateArray(allResults, pageParams));
});
```

#### Compliance, KYC, Governance Routes

Add pagination to list endpoints following the same pattern:

```typescript
router.get('/api/compliance/violations', (req, res, next) => {
  const pageParams = parseOffsetParams(req.query);
  try {
    const violations = complianceService.listViolations();
    res.json(paginateArray(violations, pageParams));
  } catch (error) {
    next(new AppError('VIOLATIONS_FETCH_FAILED', 'Failed to fetch violations', 500));
  }
});
```

---

## Standard Response Envelopes

### Offset-Based (Most Common)

**Request**:

```
GET /api/backup?limit=20&offset=40
```

**Response**:

```json
{
  "data": [
    { "id": "job-1", "status": "completed" },
    { "id": "job-2", "status": "in-progress" }
  ],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 150,
    "hasMore": true
  }
}
```

**Client Logic**:

```typescript
if (result.pagination.hasMore) {
  const nextOffset = result.pagination.offset + result.pagination.limit;
  // Fetch next page: ?offset=60&limit=20
}
```

### Cursor-Based (For Large Datasets)

**Request**:

```
GET /api/events?cursor=123&limit=20
```

**Response**:

```json
{
  "data": [
    { "id": "evt-1", "timestamp": "2024-01-01T10:00:00Z" },
    { "id": "evt-2", "timestamp": "2024-01-01T10:05:00Z" }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "123",
    "nextCursor": "143",
    "hasMore": true
  }
}
```

**Client Logic**:

```typescript
if (result.pagination.hasMore) {
  const nextCursor = result.pagination.nextCursor;
  // Fetch next page: ?cursor=143&limit=20
}
```

---

## Migration Checklist

### Phase 1: GraphQL Resolvers

- [ ] Update `graphql/resolvers/shared.ts` - Remove `paginateResults` helper
- [ ] Update `graphql/resolvers/groups.ts` - Use `paginateArray` with pagination envelope
- [ ] Update `graphql/resolvers/members.ts` - Use `paginateArray` with pagination envelope
- [ ] Update `graphql/resolvers/transactions.ts` - Use `paginateArray` with pagination envelope
- [ ] Update GraphQL schema - Add `PaginationInfo` type and pagination fields
- [ ] Test: Verify pagination metadata appears in responses

### Phase 2: REST v2 Endpoint

- [ ] Update `routes/v2.ts` - Change `/backup` from `page` to `offset` parameter
- [ ] Use `parseOffsetParams()` for consistent validation
- [ ] Test: Verify offset-based pagination works correctly
- [ ] Document: Update API docs for v2 pagination

### Phase 3: New Pagination Coverage

- [ ] Add pagination to `routes/v1.ts` - Search endpoints
- [ ] Add pagination to `routes/compliance.ts` - List endpoints
- [ ] Add pagination to `routes/kyc.ts` - List endpoints
- [ ] Add pagination to `routes/governance.ts` - List endpoints
- [ ] Test: Edge cases (empty page, last page, boundary values)

### Phase 4: Testing & Validation

- [ ] Write unit tests for pagination utility edge cases
- [ ] Write integration tests for each migrated endpoint
- [ ] Verify backward compatibility (if applicable)
- [ ] Load test pagination performance

### Phase 5: Documentation

- [ ] Update OpenAPI specification
- [ ] Document pagination contract in API reference
- [ ] Add pagination examples to each endpoint
- [ ] Update client SDKs with pagination helpers

---

## Edge Cases to Test

### Empty Results

```
GET /backup?limit=20&offset=0
```

Expected:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 0,
    "hasMore": false
  }
}
```

### Last Page (Partial Results)

```
GET /backup?limit=20&offset=140  // Only 10 items left
```

Expected:

```json
{
  "data": [/* 10 items */],
  "pagination": {
    "limit": 20,
    "offset": 140,
    "total": 150,
    "hasMore": false // No more pages after this
  }
}
```

### Out-of-Range Offset

```
GET /backup?limit=20&offset=1000  // Offset beyond total
```

Expected:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "offset": 1000,
    "total": 150,
    "hasMore": false
  }
}
```

### Invalid Parameters (Auto-Clamped)

```
GET /backup?limit=500&offset=-10  // Limit too high, offset negative
```

Expected: Clamped to valid range

```json
{
  "data": [/* 100 items (max page size) */],
  "pagination": {
    "limit": 100, // Clamped from 500
    "offset": 0, // Clamped from -10
    "total": 150,
    "hasMore": true
  }
}
```

---

## Validation Rules

All endpoints MUST enforce:

| Parameter | Min | Default | Max | Notes                   |
| --------- | --- | ------- | --- | ----------------------- |
| `limit`   | 1   | 20      | 100 | Clamped, prevents DoS   |
| `offset`  | 0   | 0       | ∞   | Clamped to valid range  |
| `cursor`  | —   | "0"     | —   | String, no length limit |

**Automatic clamping**: `clampLimit()` and `clampOffset()` in pagination.ts

---

## Benefits of Consolidation

1. **Consistency**: All endpoints follow the same pagination contract
2. **Security**: Automatic max page size enforcement prevents DoS attacks
3. **Maintainability**: Single source of truth reduces bugs
4. **Client Experience**: Predictable pagination patterns across APIs
5. **Scalability**: Cursor pagination ready for large datasets
6. **Testing**: Centralized edge case testing benefits all endpoints

---

## Implementation Order

1. **Week 1, Day 1-2**: GraphQL resolvers (3 resolvers, ~2-3 hours)
2. **Week 1, Day 2-3**: REST v2 migration (1 endpoint, ~1 hour)
3. **Week 1, Day 3-4**: Search pagination (2 routes, ~2-3 hours)
4. **Week 2, Day 1**: Compliance/KYC/Governance pagination (3 routes, ~2 hours)
5. **Week 2, Day 2**: Comprehensive testing (unit + integration, ~3 hours)
6. **Week 2, Day 3**: Documentation & review

**Total Effort**: 1-2 weeks (13-16 hours)

---

## Rollout Strategy

1. **Review phase**: Get approval for pagination contract
2. **Implementation**: Migrate one component at a time
3. **Testing**: Integration tests before each merge
4. **Soft launch**: Deploy with new pagination endpoints, keep old ones for backward compatibility
5. **Gradual migration**: Update clients incrementally
6. **Sunset**: Remove deprecated endpoints after 2-4 weeks

---

## Glossary

- **Offset**: Number of items to skip from the start
- **Limit**: Number of items to return (page size)
- **Total**: Total number of items across all pages
- **hasMore**: Boolean indicating whether more pages exist
- **Cursor**: Opaque token representing a position in the dataset
- **Clamping**: Forcing a value into a valid range (e.g., 0-100)
- **Envelope**: The JSON structure wrapping the data and metadata
