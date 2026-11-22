# Stellar-Save API Reference

> **Source of truth:** [`backend/openapi.yaml`](../../backend/openapi.yaml)
>
> This file is **generated** — do not edit by hand.
> Run `npx tsx scripts/generate-api-reference.ts` to regenerate it.

## Overview

Stellar-Save exposes a REST API for its decentralised rotational savings platform.
The API is served by the Express backend at `http://localhost:3001` (dev) or
`https://api.stellar-save.app` (production).

Interactive docs are available at `/api-docs` (Swagger UI) and `/api-docs/redoc`
(Redoc) when the server is running.

---

## Authentication

| Method | Header | Issued by |
|--------|--------|-----------|
| **Bearer JWT** | `Authorization: Bearer <token>` | `POST /api/auth/verify` |
| **API Key** | `X-API-Key: <key>` | `POST /api/v1/api-keys` |

Most endpoints are public or read-only. Endpoints that modify user data or access
admin features require one of the above.

---

## Versioning

| Version | Prefix | Status |
|---------|--------|--------|
| **v2** | `/api/v2/` | **Current** — active development |
| **v1** | `/api/v1/` | **Deprecated** — sunset 2027-01-01 |
| _(none)_ | `/api/` | Legacy unversioned paths — will be removed with v1 |

When calling a deprecated version the server sets `Deprecation: true`,
`Sunset: 2027-01-01`, and `X-API-Deprecation-Notice` headers.

---

## Rate Limiting

| Scope | Limit |
|-------|-------|
| General endpoints | 100 req / 15 min per IP |
| Auth & admin endpoints | 10 req / 15 min per IP |
| Analytics write | Stricter (see individual routes) |
| Public API (API key) | Per-tier limits |

---

## Error Envelope

All error responses use a consistent JSON shape:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "statusCode": 400,
  "details": {}
}
```

Standard HTTP codes: `400` bad request, `401` unauthenticated, `403` forbidden,
`404` not found, `409` conflict, `422` unprocessable, `500` internal error,
`502` upstream error, `503` service unavailable.

---

## Endpoint Status Key

| Badge | Meaning |
|-------|---------|
| **current** | Stable, production-ready |
| **deprecated** | Will be removed; use the listed replacement |
| **internal-only** | Not for external consumers — admin or system use |

---

## Endpoints

### Auth

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/auth/challenge` | — | current |
| POST | `/api/auth/verify` | — | current |

### User

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/user/me` | JWT | current |
| GET | `/api/user/{walletAddress}/profile` | JWT | current |
| GET | `/api/user/{walletAddress}/preferences` | JWT | current |
| PUT | `/api/user/{walletAddress}/preferences` | JWT | current |

### Health

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/healthz` | — | current |
| GET | `/readyz` | — | current |
| GET | `/api/v1/health` | — | deprecated → `/healthz` |
| GET | `/api/v1/ready` | — | deprecated → `/readyz` |
| GET | `/api/v2/health` | — | current |
| GET | `/api/v2/ready` | — | current |
| POST | `/api/csp-report` | — | internal-only |

### Groups

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/groups` | — | current |
| GET | `/api/groups/{id}` | — | current |
| POST | `/api/v2/groups/{groupId}/invite` | — | current |

### Stats

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/stats/groups` | — | current |

### Recommendations

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/recommendations/{userId}` | — | deprecated → v2 |
| POST | `/api/v1/preferences` | — | current |
| GET | `/api/v2/recommendations/{userId}` | — | current |

### Search

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/search` | — | current |
| GET | `/api/v1/search/autocomplete` | — | current |

### Analytics

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/analytics/platform` | — | current |
| GET | `/api/v1/analytics/platform/trends` | — | current |
| GET | `/api/v1/analytics/users/{userId}` | — | current |
| GET | `/api/v1/analytics/groups/{groupId}` | — | current |
| GET | `/api/v1/analytics/events` | — | current |
| POST | `/api/v1/analytics/events` | — | current |
| GET | `/api/v1/analytics/reports` | — | current |
| POST | `/api/v1/analytics/reports` | — | current |
| GET | `/api/v1/analytics/cache/stats` | — | current |
| POST | `/api/v1/analytics/cache/clear` | — | current |

### Contract Events

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/events` | — | current |
| GET | `/api/v1/events/stats` | — | current |
| GET | `/api/v1/events/stream` | — | current (SSE) |

### Export

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/v1/export` | — | current |
| GET | `/api/v1/export/{jobId}` | — | current |
| GET | `/api/v1/export/{jobId}/download` | — | current |
| GET | `/api/v1/members/{address}/export.csv` | — | current |

### Backup

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/backup` | — | current |
| POST | `/api/v1/backup` | — | current |
| GET | `/api/v1/backup/{jobId}` | — | current |
| POST | `/api/v1/backup/restore` | — | current |
| GET | `/api/v1/backup/alerts` | — | current |
| POST | `/api/v1/backup/alerts/{alertId}/acknowledge` | — | current |
| POST | `/api/v1/backup/drills/run` | — | internal-only |
| POST | `/api/v1/backup/drills/alerts/{alertId}/acknowledge` | — | internal-only |
| GET | `/api/v2/backup` | — | current |

### Notifications

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/notifications/preferences/{userId}` | — | current |
| PUT | `/api/v1/notifications/preferences/{userId}` | — | current |
| GET | `/api/v1/notifications/preferences/stats` | — | current |
| POST | `/api/v1/notifications/device-token` | — | current |
| DELETE | `/api/v1/notifications/device-token/{userId}/{deviceToken}` | — | current |
| POST | `/api/v1/notifications/send-email` | — | current |
| POST | `/api/v1/notifications/send-push` | — | current |
| POST | `/api/v1/notifications/queue` | — | current |
| POST | `/api/v1/notifications/process-queue` | — | current |
| GET | `/api/v1/notifications/history/{userId}` | — | current |
| GET | `/api/v1/notifications/stats` | — | current |
| GET | `/api/v1/notifications/templates` | — | current |
| POST | `/api/v1/notifications/templates` | — | current |
| GET | `/api/v1/notifications/templates/{templateKey}` | — | current |
| PUT | `/api/v1/notifications/templates/{templateKey}` | — | current |
| GET | `/api/v1/notifications/vapid-public-key` | — | current |
| POST | `/api/v1/notifications/subscribe` | — | current |
| DELETE | `/api/v1/notifications/subscribe` | — | current |
| POST | `/api/v1/notifications/unsubscribe/{token}` | — | current |
| POST | `/api/v1/notifications/resubscribe/{userId}` | — | current |
| GET | `/api/v1/notifications/health` | — | current |

### Webhooks

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/webhooks` | — | current |
| GET | `/api/webhooks` | — | current |
| GET | `/api/webhooks/{id}` | — | current |
| PATCH | `/api/webhooks/{id}` | — | current |
| DELETE | `/api/webhooks/{id}` | — | current |

### Governance

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/governance/proposals` | — | current |
| POST | `/api/v1/governance/proposals` | — | current |
| GET | `/api/v1/governance/proposals/{id}` | — | current |
| POST | `/api/v1/governance/proposals/{id}/vote` | — | current |
| GET | `/api/v1/governance/governors` | — | current |

### Insurance

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/groups/{groupId}/insurance` | — | current |
| PUT | `/api/v1/groups/{groupId}/insurance` | — | current |
| POST | `/api/v1/groups/{groupId}/insurance/claim` | — | current |

### SEP-31 (Cross-border Payments)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/sep31/quote` | JWT | current |
| POST | `/api/sep31/send` | JWT | current |
| GET | `/api/sep31/{id}/status` | JWT | current |

### Fiat Ramp (SEP-24)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/ramp/deposit` | JWT | current |
| POST | `/api/ramp/withdraw` | JWT | current |
| GET | `/api/ramp/{id}/status` | JWT | current |
| GET | `/api/ramp/{id}` | JWT | current |

### KYC

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/kyc/submit` | JWT | current |
| GET | `/api/kyc/status` | JWT | current |
| POST | `/api/kyc/webhook` | Signature | internal-only |

### Privacy (GDPR / CCPA)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/privacy/export` | JWT | current |
| POST | `/api/privacy/delete` | JWT | current |
| GET | `/api/privacy/requests` | JWT | current |

### API Keys

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/v1/api-keys` | — | current |
| DELETE | `/api/v1/api-keys/{keyId}` | API Key | current |
| GET | `/api/v1/api-keys/{keyId}/usage` | API Key | current |

### Public API

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/public/groups` | API Key | current |
| GET | `/api/v1/public/stats` | API Key | current |

### Members

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/members/{address}/reputation` | — | current |

### Cache

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/cache/stats` | — | current |

### Admin (internal-only)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/v1/admin/stats` | Admin JWT | internal-only |
| GET | `/api/v1/admin/users` | Admin JWT | internal-only |
| PATCH | `/api/v1/admin/users/{id}` | Admin JWT | internal-only |
| DELETE | `/api/v1/admin/users/{id}` | Admin JWT | internal-only |
| GET | `/api/v1/admin/groups` | Admin JWT | internal-only |
| POST | `/api/v1/admin/groups/{id}/flag` | Admin JWT | internal-only |
| GET | `/api/v1/admin/audit-logs` | Admin JWT | internal-only |

### Compliance (internal-only)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| POST | `/api/compliance/screen` | JWT | internal-only |
| GET | `/api/compliance/queue` | Admin JWT | internal-only |
| POST | `/api/compliance/flags/{id}/review` | Admin JWT | internal-only |
| GET | `/api/compliance/audit-log` | Admin JWT | internal-only |

### IPFS (internal-only)

| Method | Path | Auth | Status |
|--------|------|------|--------|
| GET | `/api/ipfs/health` | — | internal-only |
| GET | `/api/ipfs/node` | — | internal-only |
| GET | `/api/ipfs/pins` | — | internal-only |
| POST | `/api/ipfs/pins` | — | internal-only |
| GET | `/api/ipfs/pins/{cid}` | — | internal-only |
| DELETE | `/api/ipfs/pins/{cid}` | — | internal-only |
| POST | `/api/ipfs/pins/{cid}/retry` | — | internal-only |
| POST | `/api/ipfs/verify` | — | internal-only |
| GET | `/api/ipfs/jobs` | — | internal-only |
| GET | `/api/ipfs/groups/{groupId}/metadata` | — | internal-only |
| GET | `/api/ipfs/alerts` | — | internal-only |
| POST | `/api/ipfs/alerts/{alertId}/acknowledge` | — | internal-only |

---

## Deprecated Endpoints — Migration Guide

| Deprecated | Replacement | Sunset |
|-----------|-------------|--------|
| `GET /api/v1/health` | `GET /healthz` | 2027-01-01 |
| `GET /api/v1/ready` | `GET /readyz` | 2027-01-01 |
| `GET /api/v1/recommendations/{userId}` | `GET /api/v2/recommendations/{userId}` | 2027-01-01 |
| All `/api/v1/*` paths | Corresponding `/api/v2/*` path | 2027-01-01 |
