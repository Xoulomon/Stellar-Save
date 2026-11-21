# Issue #1693 Validation Audit: Top 10 Highest-Traffic Endpoints

**Date**: 2026-09-26  
**Objective**: Identify top 10 highest-traffic endpoints and audit validation status  
**Status**: IN PROGRESS

## Summary

Analyzed all endpoints in `backend/src/routes/v1.ts` and related route files to identify the 10 most likely high-traffic endpoints based on:
- Rate limiting middleware presence
- Caching patterns (indicates read-heavy traffic)
- Public API accessibility (no auth required or API key only)
- Analytics/monitoring endpoints
- Admin dashboard endpoints

---

## Top 10 Highest-Traffic Endpoints

### 1. **GET /api/stats/groups** ⚠️ PARTIALLY VALIDATED
- **Traffic**: Very High (landing page, public, cached 5 min)
- **Current Validation**: None (no query parameters)
- **Middleware**: Rate limit, Cache
- **Status Code**: 200/500
- **Action Required**: Add optional `date` query parameter validation
- **Notes**: Landing page endpoint, platform-wide stats aggregation
- **Validation Needed**: Optional date query param validation

---

### 2. **POST /api/analytics/events** ✅ VALIDATED
- **Traffic**: Very High (client-side event tracking, write-heavy)
- **Current Validation**: `validateBody(schemas.analyticsEventBody)` ✓
- **Middleware**: Rate limit
- **Status Codes**: 201/500
- **Schema**: `analyticsEventBody` (eventType, eventName, userId, groupId, sessionId, eventData)
- **Notes**: Event tracking from clients; high volume expected

---

### 3. **GET /api/analytics/platform** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (analytics dashboard)
- **Current Validation**: None (inline date check)
- **Middleware**: Rate limit, Cache
- **Status Codes**: 200/404/500
- **Action Required**: Create `analyticsDateQuery` schema with optional date parameter
- **Notes**: Optional `date` parameter currently not validated

---

### 4. **GET /api/events** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (contract event stream, most blockchain-heavy)
- **Current Validation**: Inline manual parsing (multiple `any` type casts)
- **Middleware**: None (consider adding)
- **Status Codes**: 200/500
- **Parameters**: contractId, eventType, startLedger, endLedger, startTime, endTime, limit, offset
- **Action Required**: Create `eventsFilterQuery` schema for contract event filtering
- **Issues**: 
  - Manual parseInt() on `startLedger`, `endLedger` (risky)
  - No validation on date strings
  - Uses `any` type throughout
  - No type safety for numeric ranges

---

### 5. **GET /api/search** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (global search, user-facing)
- **Current Validation**: Inline string check only
- **Middleware**: None
- **Status Codes**: 200/400/500
- **Parameters**: `q` (query string, required)
- **Action Required**: Create `searchQuery` schema
- **Issues**: 
  - Manual string validation
  - No length/format constraints on `q`
  - No type safety

---

### 6. **GET /api/search/autocomplete** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (user-facing, typed by user)
- **Current Validation**: Inline string check only
- **Middleware**: None
- **Status Codes**: 200/400/500
- **Parameters**: `q` (query string, required)
- **Action Required**: Create `autocompleteQuery` schema (same as search)
- **Issues**: Same as #5

---

### 7. **POST /api/export** ✅ VALIDATED
- **Traffic**: Medium-High (data export, async)
- **Current Validation**: `validateBody(schemas.exportJob)` ✓
- **Middleware**: None
- **Status Codes**: 202/500
- **Schema**: `exportJob` (userId, email, format enum)
- **Notes**: Already properly validated

---

### 8. **GET /api/analytics/groups/:groupId** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (group detail analytics)
- **Current Validation**: Path param extracted but not validated; query param `date` not validated
- **Middleware**: Rate limit, Cache
- **Status Codes**: 200/404/500
- **Parameters**: `:groupId` (path), `date` (query, optional)
- **Action Required**: Create `groupIdParam` and `analyticsDateQuery` schemas
- **Issues**: 
  - `groupId` not validated for format/length
  - `date` query param not validated

---

### 9. **GET /api/analytics/users/:userId** ⚠️ PARTIALLY VALIDATED
- **Traffic**: High (user analytics dashboard)
- **Current Validation**: Path param extracted but not validated; query param `date` not validated
- **Middleware**: Rate limit, Cache
- **Status Codes**: 200/404/500
- **Parameters**: `:userId` (path), `date` (query, optional)
- **Action Required**: Create `userIdParam` and `analyticsDateQuery` schemas
- **Issues**: 
  - `userId` not validated for format/length
  - `date` query param not validated

---

### 10. **GET /api/public/stats** ✅ MOSTLY VALIDATED
- **Traffic**: High (public API, for external integrations)
- **Current Validation**: API key auth via `apiKeyAuthMiddleware` ✓
- **Middleware**: API Key Auth, Usage Recording
- **Status Codes**: 200/500
- **Parameters**: None
- **Notes**: Auth-based validation sufficient; no query params

---

## Additional High-Traffic Endpoints (Honorable Mentions)

These would be #11-15 if scope expanded:
- **POST /api/backup** (Medium, triggers long-running job) - ✅ VALIDATED
- **GET /api/backup** (Medium, list jobs) - ⚠️ Query pagination not validated
- **GET /api/analytics/reports** (Medium, read heavy) - ⚠️ Query params not validated
- **POST /api/analytics/reports** (Medium, async) - ✅ VALIDATED
- **POST /api/preferences** (Medium, user updates) - ❌ NOT VALIDATED
- **GET /api/admin/stats** (Medium-Low, admin dashboard) - ⚠️ No auth/validation

---

## Validation Status Summary

| Status | Count | Endpoints |
|--------|-------|-----------|
| ✅ Fully Validated | 3 | POST /analytics/events, POST /export, GET /public/stats |
| ⚠️ Partially Validated | 7 | GET /stats/groups, GET /analytics/platform, GET /events, GET /search, GET /search/autocomplete, GET /analytics/groups/:groupId, GET /analytics/users/:userId |
| ❌ Not Validated | 0 | (all have at least inline validation) |

---

## Validation Gaps Identified

### Missing Query Parameter Schemas
1. **analyticsDateQuery** - Optional ISO 8601 date for analytics endpoints
2. **eventsFilterQuery** - Complex schema for contract event filtering
3. **searchQuery** - Search term with length/format constraints
4. **autocompleteQuery** - Autocomplete query with length constraints
5. **paginationWithDateRange** - Pagination + date range (startDate, endDate)

### Missing Path Parameter Schemas
1. **groupIdParam** - Validated groupId format
2. **userIdParam** - Validated userId format
3. **jobIdParam** - Validated jobId format (UUID or similar)
4. **alertIdParam** - Validated alertId format

### Missing Body Schemas
1. **userPreferences** - User preference update body
2. **adminUserUpdate** - Admin user update with `updates` and `adminId`
3. **adminGroupFlag** - Admin group flag with `flagged` boolean and `adminId`
4. **backupRestoreBody** - Optional `jobId` field validation
5. **cachePattern** - Cache pattern for clear operation

---

## Implementation Plan

### Phase 1: Create Missing Schemas (validation.ts)
1. Add `analyticsDateQuery` schema
2. Add `eventsFilterQuery` schema for contract events
3. Add `searchQuery` and `autocompleteQuery` schemas
4. Add path parameter schemas (groupId, userId, jobId, alertId)
5. Add missing body schemas for admin/preferences endpoints

### Phase 2: Update Top 10 Endpoints (v1.ts)
1. GET /stats/groups - Add query validation
2. GET /analytics/platform - Add query validation
3. GET /events - Replace inline parsing with validateQuery middleware
4. GET /search - Replace inline validation with validateQuery middleware
5. GET /search/autocomplete - Replace inline validation with validateQuery middleware
6. GET /analytics/groups/:groupId - Add param + query validation
7. GET /analytics/users/:userId - Add param + query validation
8. POST /analytics/events - Already done ✓
9. POST /export - Already done ✓
10. GET /public/stats - Already done (auth-based) ✓

### Phase 3: Standardize Error Responses
- All validation failures → 400 with standardized `ErrorEnvelope`
- Include `code: 'VALIDATION_ERROR'`
- Include detailed field-level errors in `details` field
- Include correlationId and timestamp

### Phase 4: Integration Testing
- Create test suite for each endpoint
- Test with invalid payloads (wrong types, out-of-range, missing required)
- Verify 400 + standardized error format
- Test date parsing edge cases (invalid ISO 8601, out of range)
- Test numeric coercion edge cases

### Phase 5: Verification & Code Review
- Run full test suite
- Verify backward compatibility
- Code review of validation layer

---

## Files to Modify

1. **backend/src/lib/validation.ts** - Add schemas
2. **backend/src/routes/v1.ts** - Update endpoints to use validateQuery middleware
3. **backend/src/tests/validation-integration.test.ts** - Create integration test suite (new file)

---

## Notes

- Zod v4.4.3 already in package.json ✓
- Validation middleware factories already implemented ✓
- Error handling with ErrorEnvelope pattern already in place ✓
- No new dependencies needed ✓
- All endpoints already have some form of validation (inline or middleware)
- Task is to standardize and consolidate into Zod schemas + middleware

