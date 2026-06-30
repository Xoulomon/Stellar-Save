# Observability Guide

Stellar-Save uses structured JSON logs, Prometheus metrics, Grafana dashboards,
OpenTelemetry traces, and Elasticsearch/Kibana for log search.

## Common Log Queries

Use these in Kibana or any Elasticsearch-backed log viewer:

```text
correlation_id:"<request-id>"
```

Trace a single request across backend services:

```text
service:"stellar-save-backend" AND correlation_id:"<request-id>"
```

Find backend errors with stack traces:

```text
service:"stellar-save-backend" AND level:error
```

Find backup restore drill failures:

```text
service:"stellar-save-backend" AND message:"backup restore drill failed"
```

## Common Dashboard Views

- `monitoring/grafana/dashboards/backend.json` includes backup job, export job,
  and restore drill panels.
- `monitoring/grafana/dashboards/distributed-tracing.json` covers the request
  waterfall across frontend, backend, indexer, and Soroban RPC.

## Mobile Crash Reporting

Mobile crash reports are routed to Sentry when `EXPO_PUBLIC_SENTRY_DSN` is set
in the mobile app environment.
