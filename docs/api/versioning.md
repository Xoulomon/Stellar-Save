# API Versioning & Deprecation Plan

This document defines the supported API surface for the backend and the
sunset schedule for deprecated `v1` routes. It is the source of truth for
consumers deciding which version to call.

## Supported versions

- **`v2`** — current, supported surface. New integrations must target `v2`.
- **`v1`** — legacy surface. Routes that have a `v2` equivalent are
  **deprecated** and will be removed on the sunset date below. Routes with no
  `v2` equivalent remain supported until a replacement ships.

## Deprecation headers

Deprecated `v1` routes emit the following response headers:

| Header         | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| `Deprecation`  | `true`                                                       |
| `Sunset`       | RFC 7231 HTTP-date of the removal date (see schedule below)   |
| `Link`         | `<...>; rel="deprecation"` pointing at this document         |

Clients should treat the presence of `Deprecation: true` as a signal to
migrate to the `v2` equivalent listed in the inventory.

## Sunset schedule

| Milestone                | Date       | Notes                                              |
| ------------------------ | ---------- | -------------------------------------------------- |
| Deprecation announced    | 2024-01-01 | Headers begin emitting on deprecated `v1` routes.  |
| Migration window         | 6 months   | Consumers migrate to `v2` equivalents.             |
| Sunset (removal)         | 2024-07-01 | Deprecated `v1` routes removed.                    |

## Route inventory

Every route in `backend/src/routes/v1.ts` and `backend/src/routes/v2.ts` is
listed below with its status and `v2` equivalent (if any).

### `v1` routes

| Method | Path                          | Status      | `v2` equivalent               |
| ------ | ----------------------------- | ----------- | ----------------------------- |
| GET    | `/v1/health`                  | supported   | `/v2/health`                  |
| GET    | `/v1/transactions`            | deprecated  | `/v2/transactions`            |
| GET    | `/v1/transactions/:id`        | deprecated  | `/v2/transactions/:id`        |
| POST   | `/v1/transactions`            | deprecated  | `/v2/transactions`            |
| GET    | `/v1/accounts`                | deprecated  | `/v2/accounts`                |
| GET    | `/v1/accounts/:id`            | deprecated  | `/v2/accounts/:id`            |
| GET    | `/v1/export`                  | supported   | — (no `v2` equivalent yet)    |
| GET    | `/v1/backup`                  | supported   | — (no `v2` equivalent yet)    |
| POST   | `/v1/admin/groups/:id/flag`   | supported   | — (no `v2` equivalent yet)    |

### `v2` routes

| Method | Path                          | Status      | `v1` equivalent               |
| ------ | ----------------------------- | ----------- | ----------------------------- |
| GET    | `/v2/health`                  | supported   | `/v1/health`                  |
| GET    | `/v2/transactions`            | supported   | `/v1/transactions`            |
| GET    | `/v2/transactions/:id`        | supported   | `/v1/transactions/:id`        |
| POST   | `/v2/transactions`            | supported   | `/v1/transactions`            |
| GET    | `/v2/accounts`                | supported   | `/v1/accounts`                |
| GET    | `/v2/accounts/:id`            | supported   | `/v1/accounts/:id`            |

> Routes marked **supported** in `v1` have no `v2` equivalent and are not
deprecated. They will be migrated once a `v2` replacement is published.

## Implementation notes

- The deprecation metadata lives in `backend/src/versioning.ts`
  (`DEPRECATED_V1_ROUTES`, `SUNSET_DATE`, `deprecationHeaders()`).
- The `v1` router applies `deprecationHeaders()` middleware to every route
  listed in `DEPRECATED_V1_ROUTES`.
- Integration coverage lives in
  `backend/src/routes/versioning.test.ts`, asserting that deprecated routes
  return `Deprecation` and `Sunset` headers.
