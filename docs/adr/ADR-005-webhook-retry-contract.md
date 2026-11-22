# ADR-005: Webhook Retry Contract and Idempotency Semantics

## Status
Accepted

## Context
Outbound and inbound webhook notifications must handle network disruptions, receiver timeouts, and server restarts without dropping events or flooding destinations.
The Rust client (`client/src/webhook_retry.rs`) and backend delivery/receiver pipelines (`backend/src/modules/webhooks/`, `backend/src/routes/webhooks.ts`) interact over HTTP webhooks. Without a shared, standardized contract specifying backoff intervals, max retry attempts, idempotency keys, and dead-letter queue (DLQ) transitions, the two systems risk silent behavioral drift.

---

## Decision

We establish an immutable contract governing webhook retries, headers, and idempotency guarantees across both client and backend implementations.

### 1. Delivery & Retry Parameters
- **Maximum Delivery Attempts (`MAX_ATTEMPTS`)**: `5`
- **Initial Delay (`BASE_DELAY_SECS`)**: `1` second (1,000 ms)
- **Maximum Delay Cap (`MAX_DELAY_SECS`)**: `300` seconds (5 minutes)
- **Backoff Algorithm**: Truncated Exponential Backoff
  $$\text{delay}(attempt) = \min(\text{BASE\_DELAY} \times 2^{attempt}, \text{MAX\_DELAY})$$
  - Attempt 0 (initial): immediate ($0\text{s}$)
  - Attempt 1: $1 \times 2^1 = 2\text{s}$
  - Attempt 2: $1 \times 2^2 = 4\text{s}$
  - Attempt 3: $1 \times 2^3 = 8\text{s}$
  - Attempt 4: $1 \times 2^4 = 16\text{s}$
  - After 5 failures: moved immediately to **Dead Letter Queue (DLQ)** for inspection and alerting.

### 2. Standard HTTP Webhook Headers
Every webhook dispatch must include the following headers:
- `Content-Type`: `application/json`
- `X-Webhook-Signature`: `sha256=<hex_hmac_hash>` computed with the shared secret over `${timestamp}.${body}`.
- `X-Webhook-Timestamp`: Unix epoch milliseconds as string.
- `Idempotency-Key`: Unique idempotency key (format: `whk_<eventId>_<nonce>` or `whk_<eventId>`).
- `X-Delivery-Attempt`: Positive integer string representing attempt number (`0` through `4`).

### 3. Idempotency & Receiver Contract
- Receivers must track `Idempotency-Key` or event ID over a minimum 24-hour sliding window.
- If a delivery with an already-processed `Idempotency-Key` is received, the receiver must acknowledge with HTTP `200 OK` (or `202 Accepted`) without re-executing side effects.
- If a delivery attempt encounters HTTP 5xx or connection timeout, the sender must retry following the exponential backoff schedule.
- HTTP 4xx responses (e.g. 400 Bad Request, 401 Unauthorized, 404 Not Found) except 429 Too Many Requests are terminal failures and are dead-lettered immediately.
- HTTP 429 responses honor `Retry-After` if present, capped by `MAX_DELAY_SECS`.

### 4. Retry Storm Protection
To prevent thundering herd / retry storms when a receiving service recovers:
- Senders maintain an in-memory or queue-backed rate limiter on retry executions.
- Senders enforce queue depth limits and drain exhausted messages to DLQ.
- Receivers implement bounded concurrency and rate limiting.

---

## Consequences
- The Rust client implementation in `client/src/webhook_retry.rs` and the backend service `backend/src/lib/webhook_retry.ts` conform to identical constants and formulas.
- Integration tests simulate failure bursts (retry storms) to verify that max retry counts, backoff progression, and DLQ handling remain synchronized.
