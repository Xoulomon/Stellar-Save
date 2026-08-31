# Runbook: Fiat Ramp Incident

**Alert:** Anchor deposit/withdraw failures or anchor unreachable
**Severity:** High (users cannot move fiat in/out)
**Trigger:** Elevated error rate on ramp session creation, anchor health check failing, or circuit breaker tripped (HTTP 503)

See [fiat-ramp-integration.md](../fiat-ramp-integration.md) for the full SEP-10/24/31 flow
this runbook responds to.

## Circuit Breaker Protection

All outbound calls to external anchor servers (TOML discovery, SEP-10 authentication, SEP-24 deposit/withdraw initiation, and status polling) are wrapped with a `CircuitBreaker`.

### Circuit Breaker Settings
- **Timeout**: 5000ms per request.
- **Volume Threshold**: Minimum 3 calls evaluated.
- **Failure Threshold**: 50% failure rate.
- **Reset Timeout**: 10,000ms (10 seconds) in `OPEN` state before transitioning to `HALF_OPEN`.

### Observed Symptom when Circuit Trips
- API returns `503 Service Unavailable` with message: `"Fiat ramp provider is currently unavailable (circuit open)"`.
- Logs record `[CircuitBreaker] Circuit breaker is OPEN — anchor request blocked`.

## Immediate Steps

1. Identify the affected anchor and flow (deposit vs. withdraw, SEP-24 vs. SEP-31):
   ```bash
   grep "ramp" /var/log/stellar-save-backend/*.log | tail -50
   # or Kibana: index=stellar-save-backend-* path=/ramp/* level=error
   ```

2. Check the circuit breaker state and anchor health:
   ```bash
   curl https://<anchor-domain>/.well-known/stellar.toml
   curl https://<anchor-domain>/sep24/info
   ```

3. If the anchor is down or returning errors:
   - The circuit breaker will automatically open and reject traffic fast to prevent thread pool exhaustion and cascading backend failures.
   - Do **not** retry continuously on the user's behalf — surface the `503 Service Unavailable` status in the app.

4. If SEP-10 auth is failing (JWT issuance), confirm the backend's account/domain is still
   correctly listed in the anchor's allowlist (if one exists) and that the challenge
   transaction round-trip hasn't changed shape after an anchor-side update.

5. Resetting the Circuit Breaker:
   - Once the upstream anchor recovers, the circuit breaker automatically tests connectivity during the `HALF_OPEN` state after the 10-second reset window.
   - If manual reset is required in administrative tasks: `fiatRampCircuitBreaker.reset()`.

6. If users report funds sent to an anchor but not reflected in-app, reconcile via
   `GET /transaction?id=<id>` against the anchor directly — do not assume funds are lost
   before confirming the anchor's authoritative status.

## Escalation

- Anchor outage lasting > 30 min → notify users in-app that the ramp is degraded and link
  to anchor-reported status if available.
- Suspected fund mismatch (user paid, no corresponding Stellar transaction) → escalate to
  the anchor's support channel immediately; do not attempt to manually credit a user's
  in-app balance without anchor confirmation.
- Suspected KYC data exposure (e.g. KYC payload found in our logs) → treat as a security
  incident per [SECURITY.md](../SECURITY.md), not a routine ramp failure.

## Post-Incident

- File an incident report within 24 hours, including which anchor and SEP flow was
  affected and circuit breaker trip metrics.
- If caused by an anchor-side breaking change, add a contract/schema check to detect that
  class of change earlier.
