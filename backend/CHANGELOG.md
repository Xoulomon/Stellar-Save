# Changelog — backend

All notable changes to the `backend` package are documented here. This file
follows the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.
Versions align with `backend/package.json` and correspond to Git tags prefixed
with `backend/`.

> **Auto-generation note:** Starting with v1.1.0 this file will be updated
> automatically on every tagged release by `.github/workflows/changelog.yml`.
> Until then, entries are backfilled manually.

---

## [Unreleased]

_No unreleased changes tracked yet._

---

## [1.0.0] — 2026-08-28

Initial production release of the Stellar Save backend service.

### Added

#### API versioning
- Dual-version Express router: `v1` (`src/routes/v1.ts`) and `v2`
  (`src/routes/v2.ts`).
- `versionMiddleware` (`src/versioning.ts`) extracts the version from the URL
  path (`/api/v1/…`, `/api/v2/…`), attaches it to the request, and injects
  deprecation headers for v1.
- OpenAPI specification at `backend/openapi.yaml` (comprehensive endpoint
  documentation).
- Interactive API docs served at `GET /docs` via `src/docs.ts`.

#### Admin API cleanup — 2026-07-28 (closes #37)
A full audit of the admin API surface removed unused scaffold endpoints and
implemented the endpoints the `AdminDashboardPage` frontend actually calls.

**Removed (5 unused scaffold endpoints):**
- `GET  /api/v1/admin/reconciliation/status`
- `POST /api/v1/admin/reconciliation/run`
- `GET  /api/v1/admin/fraud/flags`
- `PATCH /api/v1/admin/fraud/flags/:id`
- `POST /api/v1/admin/fraud/scan`

**Added (7 required admin endpoints):**
- `GET  /api/v1/admin/stats` — platform health metrics (total users, groups,
  transactions, volume, system health, last backup timestamp).
- `GET  /api/v1/admin/users` — list all users for moderation, including
  `flagged` status.
- `PATCH /api/v1/admin/users/:id` — update user name and/or `flagged` status.
- `DELETE /api/v1/admin/users/:id` — permanently remove a user.
- `GET  /api/v1/admin/groups` — list all groups, including `flagged` status.
- `POST /api/v1/admin/groups/:id/flag` — flag or unflag a group for review.
- `GET  /api/v1/admin/audit-logs` — retrieve the full admin audit trail.

All admin endpoints:
- Require `adminAuthMiddleware` (401 on missing/invalid credentials).
- Log every state-changing action to the audit trail via `AdminService.logAction()`.
- Validate all request body parameters (type and presence).

#### Data model changes (relates to #37)
- `Member` interface (`src/models.ts`) — added `flagged?: boolean`.
- `Group` interface (`src/models.ts`) — added `flagged?: boolean`.
- `AdminService.logAction()` made `public` to allow direct invocation from
  route handlers.

#### Contract event indexer
- `ContractEventIndexer` (`src/contract_event_indexer.ts`) — polls Soroban
  events and writes to the database; event types documented in
  `docs/contract-event-indexer.md`.
- `EventsTable` migration (`database/migrations/001_create_events_table.sql`).

#### Notification services
- `NotificationService` (`src/notification_service.ts`) — email, push, and
  in-app notification dispatch.
- `NotificationTemplateManager` — template registry for all notification types.
- `WebPushService` (`src/web_push_service.ts`) — VAPID-based Web Push.
- `PushNotificationService` (`src/push_notification_service.ts`) — Firebase
  FCM adapter.
- `DeviceTokenService` — device-token registration and management.

#### Fraud detection & compliance
- `FraudDetectionService` (`src/fraud_detection_service.ts`) — heuristic
  rule engine for suspicious contribution patterns.
- `FraudDetectionWorker` — background BullMQ worker for async fraud checks.
- `AmlService` (`src/aml_service.ts`) — AML screening integration.
- `FiatRampProtection` (`src/fiat_ramp_protection.ts`) — SEP-24/31 guard
  middleware.

#### Analytics
- `AnalyticsService` (`src/analytics_service.ts`) — event ingestion and
  aggregation.
- `AnalyticsAggregator` (`src/analytics_aggregator.ts`) — pre-computed
  rollups for dashboard queries.
- `AnalyticsMiddleware` (`src/analytics_middleware.ts`) — request-level event
  emission.
- `WarehouseExport` (`src/warehouse_export.ts`) — periodic export to data
  warehouse.
- Funnel and cohort analytics composables in `analytics/` (root package).

#### WebSocket gateway
- `WsGateway` (`src/ws_gateway.ts`) — real-time event streaming to connected
  frontend clients.

#### GraphQL layer
- Apollo Server v4 with `makeExecutableSchema`; schema and resolvers under
  `src/graphql/`.
- `graphql-depth-limit` to prevent query-depth abuse.

#### Security & middleware stack
- `SecurityHeadersMiddleware` (`src/security_headers_middleware.ts`) — HSTS,
  CSP, X-Frame-Options, etc.
- `InputSanitizationMiddleware` (`src/input_sanitization_middleware.ts`) —
  strips potentially dangerous input.
- `AuthMiddleware` (`src/auth_middleware.ts`) — JWT verification.
- `AuthService` (`src/auth_service.ts`) — token issuance and rotation.
- `ApiKeyService` (`src/api_key_service.ts`) — API key lifecycle management.
- `ApiKeyRateLimiter` — per-key rate limits.
- `RateLimiter` (`src/rate_limiter.ts`) — IP-level and global rate limiting.
- `RedisRateLimiter` (`src/redis_rate_limiter.ts`) — tiered Redis-backed
  rate limiting with per-endpoint cost configuration.
- `KeyRotationService` (`src/key_rotation_service.ts`) — automated key
  rotation; Lambda handler at `src/secrets_rotation_lambda.ts`.
- `SecretsManagerService` (`src/secrets_manager_service.ts`) — AWS Secrets
  Manager integration.
- Audit event log (`src/audit_event_log.ts`) — immutable action trail for
  compliance.
- Regulatory audit trail (`src/regulatory_audit_trail.ts`) — structured
  export for legal/compliance review.

#### Observability
- OpenTelemetry distributed tracing (`src/tracing.ts`) — auto-instrumented
  Express, HTTP, pg, and ioredis spans; OTLP HTTP exporter.
- Prometheus metrics (`src/metrics.ts`) with `prom-client`; exposed at
  `GET /metrics`.
- Winston structured logging (`src/logger.ts`) with daily-rotate-file
  transport.
- Graceful shutdown handler (`src/graceful_shutdown.ts`).

#### Data services
- Prisma ORM (`prisma/schema.prisma`) with PostgreSQL; client singleton at
  `src/prisma_client.ts`.
- `ReconciliationService` (`src/reconciliation_service.ts`) — on-chain vs.
  off-chain balance reconciliation.
- `TransactionDecoderService` (`src/transaction_decoder_service.ts`) — decodes
  raw Stellar XDR transactions into structured records.
- `BackupService` and `BackupScheduler` — periodic PostgreSQL snapshot uploads
  to S3.
- `BackupRestoreDrill` — automated restore verification.
- `BackupMonitor` — CloudWatch alert integration for backup health.
- `RecoveryService` (`src/recovery_service.ts`) — playbook-driven disaster
  recovery.

#### Recommendation & reputation
- `RecommendationEngine` (`src/recommendation.ts`) — group-matching
  recommendations for new users.
- `ReputationService` (`src/reputation_service.ts`) — member on-chain
  reputation scores.
- `AmbassadorService` (`src/ambassador_service.ts`) — referral and ambassador
  programme management.

#### Export & user preferences
- `ExportService` (`src/export_service.ts`) — CSV/Excel export of group and
  contribution data.
- `UserPreferenceManager` (`src/user_preference_manager.ts`) — per-user
  settings storage.

#### IPFS integration
- `src/ipfs/` — group metadata pinning to IPFS; referenced from
  `docs/group-metadata.md`.

#### Search
- `src/search.ts` — full-text group search backed by Elasticsearch
  (`@elastic/elasticsearch ^9`).

#### BullMQ job queue
- Background jobs in `src/jobs/`; queue configuration via
  `@nestjs/bullmq` and `bullmq`.
- `FraudDetectionWorker`, backup scheduler, and analytics aggregation run
  as separate BullMQ workers.

#### Testing
- Jest with ts-jest; coverage gate: 60 % lines.
- Authorization test suite `src/tests/admin_authz.test.ts` — 18 tests
  covering auth, input validation, and audit-trail logging for all admin
  endpoints.
- Integration test setup under `backend/test/` with a dedicated Docker
  Compose environment (`test/docker-compose.test.yml`).
- SEP-24 integration test suite (`--testPathPattern=sep24-fiat-ramp`).

### Changed
- N/A (initial release).

### Deprecated

#### API v1 (relates to #37)
`/api/v1/*` is **deprecated** and will be removed after **2027-01-01**
(sunset date).

All new work must target `/api/v2/*`. The deprecation headers are injected
automatically by `versionMiddleware`:

```
Deprecation: true
Sunset: 2027-01-01
X-API-Deprecation-Notice: API v1 is deprecated. Please migrate to v2.
  See /docs/api-versioning.md
X-API-Version: v1
```

Migration guide: [`docs/api-versioning.md`](../docs/api-versioning.md).

### Removed
- N/A (initial release, but 5 unused admin scaffold endpoints were removed
  before this release as documented in the "Admin API cleanup" section above).

### Fixed
- N/A (initial release).

### Security
- All admin endpoints protected with `adminAuthMiddleware`; 401 returned on
  missing or invalid credentials.
- JWT tokens validated server-side; client-side role checks are UI-only guards.
- All state-changing admin operations logged to the immutable audit trail.
- API key and JWT rotation handled automatically by `KeyRotationService`.
- Secrets stored in AWS Secrets Manager; never in environment files committed
  to source control.
- Input sanitization and rate limiting applied globally via Express middleware.

---

## Upgrade Notes

### Migrating from API v1 to v2
1. Update all base URLs from `/api/v1/` to `/api/v2/`.
2. Replace the removed scaffold admin endpoints
   (`/admin/reconciliation/*`, `/admin/fraud/*`) with the new endpoints
   documented above.
3. Ensure your HTTP client reads the `Deprecation` and `Sunset` headers to
   receive early warning of future removals.

Full migration guide: [`docs/api-versioning.md`](../docs/api-versioning.md).

---

[Unreleased]: https://github.com/Xoulomon/Stellar-Save/compare/backend/v1.0.0...HEAD
[1.0.0]: https://github.com/Xoulomon/Stellar-Save/releases/tag/backend/v1.0.0
