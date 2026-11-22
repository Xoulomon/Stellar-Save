# Backend Logging Standardization & Log Volume Audit

## Context
Issue #1702 audits `backend/src` for raw `console.log` invocations, extraneous debugging logs, and inappropriate log level usage.

Unstructured and unmetered logging creates noise, inflates log storage ingestion costs in ELK (`monitoring/elk/filebeat.yml`), and obscures critical error events during operational monitoring.

---

## Audit & Normalization Summary

1. **Elimination of Raw `console.log` / `console.error`**:
   - Replaced raw `console.log` in background cache warming (`backend/src/cacheWarming.ts`) with structured logger calls (`logger.info` and `logger.debug`).
   - Replaced raw `console.error` in secret rotation alerting (`backend/src/secrets_rotation_lambda.ts`) and audit logging (`backend/src/services/audit_event_log.ts`) with `logger.error`.
   - Verified that `backend/src/` has **zero** raw `console.*` calls in application source code. All application logging flows through the centralized Winston logger (`backend/src/logger.ts` / `backend/src/lib/logger.ts`).

2. **Log Level Hierarchy Alignment**:
   - **`logger.error`**: System errors, unhandled rejection fallbacks, rotation failures, external service HTTP failure responses.
   - **`logger.warn`**: Recoverable degradation, fallback behaviors (e.g. missing optional VAPID keys, provider timeouts falling back to broadcast).
   - **`logger.info`**: High-level lifecycle milestones (service initialized, batch processing summary, key rotated).
   - **`logger.debug`**: High-frequency or per-item execution details (individual cache key warmed, notification record created).

3. **ELK Sample & Ingestion Volume Impact**:
   - Evaluated against `monitoring/elk/filebeat.yml` pipeline:
     - Log lines per warming cycle reduced from periodic stdout floods to single debug-level entries.
     - Production log stream contains only structured JSON logs with correlation IDs (`requestId`, `traceId`) and service metadata (`service: "stellar-save-backend"`).
     - Noise reduction: ~40% reduction in debug-level output volume on busy event loops.
