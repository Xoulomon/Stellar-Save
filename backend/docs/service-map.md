# Backend Service Map

This document groups the flat service files under `backend/src` by domain, notes
consolidation candidates, and flags services whose ownership is unclear.

> Scope: this is a descriptive map of the current state. It does not change any
> service behavior. See the Backend/Modularization issues for the follow-up work
> that acts on the consolidation candidates listed here.

## Domains

### Auth & Identity

| Service | Notes |
| --- | --- |
| `auth_service.ts` | Primary authentication entry point. |
| `session_service.ts` | Session lifecycle. |
| `token_service.ts` | Token issuance/validation. |
| `permission_service.ts` | Authorization checks. |
| `user_service.ts` | User profile/identity records. |

### Analytics & Reporting

| Service | Notes |
| --- | --- |
| `analytics_service.ts` | Core analytics aggregation. |
| `reporting_service.ts` | Report generation. |
| `metrics_service.ts` | Metric collection. |
| `dashboard_service.ts` | Dashboard data assembly. |

### Payments & Billing

| Service | Notes |
| --- | --- |
| `payment_service.ts` | Payment processing. |
| `billing_service.ts` | Billing cycles/invoices. |
| `subscription_service.ts` | Subscription state. |
| `invoice_service.ts` | Invoice records. |

### Admin & Compliance

| Service | Notes |
| --- | --- |
| `admin_service.ts` | Admin operations. |
| `aml_service.ts` | Anti-money-laundering checks. |
| `kyc_service.ts` | Know-your-customer checks. |
| `audit_service.ts` | Audit logging. |
| `compliance_service.ts` | Compliance rules. |

### Infrastructure & Platform

| Service | Notes |
| --- | --- |
| `config_service.ts` | Configuration access. |
| `cache_service.ts` | Caching layer. |
| `queue_service.ts` | Background job queue. |
| `notification_service.ts` | Outbound notifications. |
| `storage_service.ts` | Object/file storage. |
| `logging_service.ts` | Structured logging. |

## Consolidation Candidates

These services overlap in responsibility and are candidates for merging into a
single domain service (tracked by the modularization issues):

- `analytics_service.ts` + `metrics_service.ts` + `reporting_service.ts` —
  overlapping aggregation/reporting concerns.
- `payment_service.ts` + `billing_service.ts` + `invoice_service.ts` —
  billing-adjacent responsibilities that could share one boundary.
- `aml_service.ts` + `kyc_service.ts` + `compliance_service.ts` —
  compliance checks with duplicated rule evaluation.
- `cache_service.ts` + `storage_service.ts` — both wrap external persistence.

## Unclear Ownership (Follow-up Needed)

These services have no clear owning team and should be assigned before any
modularization work touches them:

- `dashboard_service.ts` — spans analytics and admin concerns.
- `notification_service.ts` — used by multiple domains; no single owner.
- `config_service.ts` — cross-cutting; ownership undefined.
- `audit_service.ts` — overlaps admin and infra responsibilities.

## Related Work

- Backend/Modularization issues (consolidation follow-ups).
- `backend/README.md` links back to this map.
