# Backend Observability

This document describes how request correlation flows through the backend so a
single user action can be traced across the HTTP layer, logs, metrics, and
outgoing calls.

## Correlation fields

Every request is assigned a **request ID** and a **trace ID**. Both are stored in
async context for the lifetime of the request and attached to every log line.

| Field        | Source                                              | Where it appears                          |
| ------------ | --------------------------------------------------- | ----------------------------------------- |
| `requestId`  | Incoming `x-request-id` header, or generated (UUID) | Log lines, response header, outgoing calls |
| `traceId`    | Active trace context (W3C `traceparent`), or generated | Log lines, outgoing calls              |
| `spanId`     | Active span in the trace context                    | Log lines, outgoing calls                 |

### Request ID

Middleware accepts an incoming `x-request-id` header when present and otherwise
generates a new one. The value is stored in async context (see
`backend/src/logger.ts`) and echoed back on the response as `x-request-id` so
clients can correlate their own logs.

### Trace ID

Tracing (see `backend/src/tracing.ts`) establishes a trace context per request.
The trace ID and current span ID are read from that context and included in the
async store alongside the request ID.

## Logging

The logger reads the async context on every log call and automatically attaches
`requestId`, `traceId`, and `spanId` to the emitted log line. Call sites do not
need to pass these values manually.

Example log line:

```json
{
  "level": "info",
  "message": "horizon request completed",
  "requestId": "3f1c2a9e-...",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7"
}
```

## Outgoing calls

Outgoing Soroban RPC, Horizon, and webhook requests forward the trace context so
downstream services can join the same trace:

- **Soroban RPC / Horizon**: the W3C `traceparent` header is injected on each
  request.
- **Webhooks**: the `traceparent` header and an `x-request-id` header carrying
  the current request ID are attached to the outgoing request.

This lets a single user action be followed end-to-end across services.

## Testing

- A unit test asserts that a log line emitted inside a request contains the
  request ID.
- A test asserts that outgoing requests include the propagation header
  (`traceparent`).
