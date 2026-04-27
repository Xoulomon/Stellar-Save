# API Versioning

## Strategy

Stellar-Save uses **URL path versioning**: the version is embedded in the path prefix.

```
/api/v1/<resource>
/api/v2/<resource>
```

This makes the version explicit, cache-friendly, and easy to route at the infrastructure level.

## Supported Versions

| Version | Status     | Sunset Date |
|---------|------------|-------------|
| v1      | Deprecated | 2027-01-01  |
| v2      | Current    | —           |

## Deprecation Policy

1. A version is marked **deprecated** at least **12 months** before removal.
2. Every response from a deprecated version includes three headers:
   - `Deprecation: true`
   - `Sunset: <ISO date>` — the date the version will stop responding.
   - `X-API-Deprecation-Notice: <human-readable message>`
3. After the sunset date the version returns `410 Gone`.

## Response Headers

Every versioned response includes:

```
X-API-Version: v1   (or v2, etc.)
```

Deprecated versions additionally include:

```
Deprecation: true
Sunset: 2027-01-01
X-API-Deprecation-Notice: API v1 is deprecated. Please migrate to v2. See /docs/api-versioning.md
```

## Endpoints

### v1

All original endpoints are available under `/api/v1/`:

| Method | Path                                    | Description                    |
|--------|-----------------------------------------|--------------------------------|
| GET    | /api/v1/health                          | Health check                   |
| GET    | /api/v1/recommendations/:userId         | Group recommendations          |
| POST   | /api/v1/preferences                     | Set user preferences           |
| GET    | /api/v1/search?q=                       | Global search                  |
| GET    | /api/v1/search/autocomplete?q=          | Autocomplete suggestions       |
| POST   | /api/v1/export                          | Create export job              |
| GET    | /api/v1/export/:jobId                   | Get export job status          |
| GET    | /api/v1/export/:jobId/download          | Download export file           |
| POST   | /api/v1/backup                          | Trigger manual backup          |
| GET    | /api/v1/backup                          | List backup jobs               |
| GET    | /api/v1/backup/:jobId                   | Get backup job                 |
| POST   | /api/v1/backup/restore                  | Restore from backup            |
| GET    | /api/v1/backup/alerts                   | List backup alerts             |
| POST   | /api/v1/backup/alerts/:alertId/acknowledge | Acknowledge alert           |

### v2

v2 is the current stable version. It extends v1 with:

- All responses include `"apiVersion": "v2"`.
- `GET /api/v2/health` — adds `uptime` field.
- `GET /api/v2/recommendations/:userId` — always uses collaborative filtering; drops A/B bucket field.
- `GET /api/v2/backup` — supports `?page=&limit=` pagination.
- All other v1 endpoints return `501 Not Implemented` with a hint pointing to the v1 equivalent.

## Legacy (Unversioned) Paths

Paths without a version prefix (e.g. `/health`, `/backup`) continue to work for backward compatibility but are deprecated. They behave identically to `/api/v1/` and include the same deprecation headers.

Migrate by prepending `/api/v1/` (or `/api/v2/` where available) to all paths.

## Migration Guide: v1 → v2

### 1. Update base URL

```diff
- const BASE = 'https://api.example.com/api/v1';
+ const BASE = 'https://api.example.com/api/v2';
```

### 2. Recommendations response shape

v1:
```json
{ "userId": "u1", "bucket": "A", "algorithm": "content", "recommendations": [...] }
```

v2:
```json
{ "userId": "u1", "algorithm": "collaborative", "recommendations": [...], "apiVersion": "v2" }
```

Remove any code that reads `bucket` or branches on `algorithm`.

### 3. Backup list pagination

v2 `GET /api/v2/backup` returns a paginated envelope:

```json
{ "data": [...], "total": 42, "page": 1, "limit": 20, "apiVersion": "v2" }
```

Update any code that expected a plain array.

### 4. Unimplemented v2 endpoints

If you call a v2 path that isn't implemented yet, you'll receive:

```json
{ "error": "Not implemented in v2 yet", "hint": "Try the v1 equivalent: /api/v1/...", "apiVersion": "v2" }
```

Fall back to the v1 path until the endpoint is promoted.

## Adding a New Version

1. Create `backend/src/routes/vN.ts` exporting `createVNRouter(services)`.
2. Add `'vN'` to `SUPPORTED_VERSIONS` in `versioning.ts`.
3. Mount the router in `index.ts`: `app.use('/api/vN', createVNRouter(services))`.
4. If the previous version is being deprecated, add it to `DEPRECATED_VERSIONS` in `versioning.ts`.
5. Write tests in `backend/src/tests/versioning.test.ts`.
6. Update this document.
