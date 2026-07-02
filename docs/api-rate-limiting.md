# API Rate Limiting & Quota Management Guide

This guide explains how Stellar-Save enforces rate limits, how to read the
response headers, and how to design clients that handle throttling gracefully.

---

## Rate Limit Headers

Every API response includes the following headers so clients can track
consumption without waiting for a `429` error.

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | UTC epoch (ms) when the window resets |
| `Retry-After` | Seconds to wait before retrying (only on `429`) |

Example response headers:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1719654120000
```

When a limit is breached the server responds with **HTTP 429**:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 34
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719654120000
Content-Type: application/json

{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please wait 34 seconds before retrying.",
  "retryAfter": 34
}
```

---

## Quota Tiers

The API uses a **sliding-window** algorithm applied independently per time
window. Each tier has two windows — a short burst limit and an hourly quota:

| Tier | Per-minute limit | Per-hour limit | Notes |
|---|---|---|---|
| **Free** | 30 req/min | 500 req/hr | Default for unauthenticated or new accounts |
| **Pro** | 300 req/min | 10 000 req/hr | Requires a Pro API key (`ss_…`) |
| **Enterprise** | 3 000 req/min | 100 000 req/hr | Contact us for custom SLAs |
| **Admin** | Unlimited | Unlimited | Internal use; `x-admin-secret` required |

### Endpoint Costs

Some endpoints count as more than one request against your quota:

| Endpoint | Cost | Category |
|---|---|---|
| `GET /api/groups` | 1 | read |
| `POST /api/groups` | 2 | write |
| `POST /api/groups/:id/contribute` | 2 | write |
| `POST /api/groups/:id/payout` | 3 | write |
| `GET /api/admin/*` | 1 | admin |

### Upgrading Your Tier

1. Generate a **Pro** or **Enterprise** API key via the dashboard or
   `POST /api/keys`.
2. Pass the key in every request:
   ```http
   Authorization: Bearer ss_<your-api-key>
   ```
3. Tier detection is automatic — no additional configuration needed.

---

## Backoff Strategies

### Exponential Backoff with Jitter (recommended)

```typescript
async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries = 5,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429) return res;

    if (attempt === maxRetries) throw new Error('Rate limit: max retries exceeded');

    // Prefer the server-supplied Retry-After value; fall back to exponential backoff.
    const retryAfterSec = Number(res.headers.get('Retry-After') ?? 0);
    const baseDelay = retryAfterSec > 0
      ? retryAfterSec * 1_000
      : Math.min(1_000 * 2 ** attempt, 60_000);
    const jitter = Math.random() * 1_000;

    await new Promise(r => setTimeout(r, baseDelay + jitter));
  }
  throw new Error('Unreachable');
}
```

### Python Example

```python
import time, random, requests

def fetch_with_backoff(url, headers, max_retries=5):
    for attempt in range(max_retries + 1):
        resp = requests.get(url, headers=headers)
        if resp.status_code != 429:
            return resp
        if attempt == max_retries:
            raise RuntimeError("Rate limit: max retries exceeded")
        retry_after = int(resp.headers.get("Retry-After", 0))
        base = retry_after if retry_after > 0 else min(2 ** attempt, 60)
        time.sleep(base + random.random())
```

### Best Practices

- **Read `X-RateLimit-Remaining` proactively** — slow down before hitting 0
  rather than waiting for a `429`.
- **Never use a fixed delay** — fixed delays cause retry storms when many
  clients share the same window. Always add jitter.
- **Cache read responses** — use `ETag` / `Last-Modified` headers to avoid
  redundant requests.
- **Batch writes** — group multiple contributions or operations into a single
  request where the API supports it.

---

## Checking Your Current Quota Usage

```http
GET /api/quota
Authorization: Bearer ss_<your-api-key>
```

Response:

```json
{
  "tier": "pro",
  "windows": [
    {
      "window": "1m",
      "windowMs": 60000,
      "limit": 300,
      "used": 47,
      "remaining": 253,
      "resetAt": 1719654060000
    },
    {
      "window": "1h",
      "windowMs": 3600000,
      "limit": 10000,
      "used": 312,
      "remaining": 9688,
      "resetAt": 1719657600000
    }
  ]
}
```

---

## Troubleshooting

### I keep getting 429 even with a Pro key

1. Confirm your `Authorization` header uses the **full** key including the
   `ss_` prefix.
2. Check `X-RateLimit-Reset` — the window may not have rolled over yet.
3. Remember that write endpoints cost more than 1 request unit. A burst of
   `POST /contribute` calls can exhaust your per-minute quota faster than
   equivalent GET calls.

### My requests are being limited at a lower threshold than my tier

The API applies **two independent windows simultaneously** (per-minute and
per-hour). Your per-minute window may be fine while the hourly quota is
exhausted, or vice versa. Inspect both `X-RateLimit-*` header groups.

### 429 with no `Retry-After` header

This should not happen in normal operation. If you observe it, the request
likely hit the IP-level (unauthenticated) limit before reaching the
tier-based limit. Authenticate your requests to benefit from the higher
per-user quota.

### SDK / library swallows the 429

If your HTTP library raises an exception instead of returning the response
object, extract `retryAfter` from the parsed JSON body:

```typescript
try {
  const data = await apiClient.post('/groups');
} catch (err: any) {
  if (err?.status === 429) {
    const waitSec = err?.body?.retryAfter ?? 60;
    await new Promise(r => setTimeout(r, waitSec * 1_000));
  }
}
```

---

## Related Documentation

- [API Reference](./api-reference.md)
- [API Versioning](./api-versioning.md)
- [Security Guide](./security-guide.md)
