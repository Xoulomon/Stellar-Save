# Runbook: Fiat Ramp Incident

**Alert:** Anchor deposit/withdraw failures or anchor unreachable
**Severity:** High (users cannot move fiat in/out)
**Trigger:** Elevated error rate on ramp session creation, or anchor health check failing

See [fiat-ramp-integration.md](../fiat-ramp-integration.md) for the full SEP-10/24/31 flow
this runbook responds to.

## Immediate Steps

1. Identify the affected anchor and flow (deposit vs. withdraw, SEP-24 vs. SEP-31):
   ```bash
   grep "ramp_session" /var/log/stellar-save-backend/*.log | tail -50
   # or Kibana: index=stellar-save-backend-* path=/ramp/* level=error
   ```

2. Check the anchor's own status/health, since most ramp failures originate there, not in
   our backend:
   ```bash
   curl https://<anchor-domain>/.well-known/stellar.toml
   curl https://<anchor-domain>/sep24/info
   ```

3. If the anchor is down or returning errors, do **not** retry on the user's behalf —
   surface a clear "ramp provider unavailable" status in the app rather than resubmitting
   KYC or payment data.

4. If SEP-10 auth is failing (JWT issuance), confirm the backend's account/domain is still
   correctly listed in the anchor's allowlist (if one exists) and that the challenge
   transaction round-trip hasn't changed shape after an anchor-side update.

5. If users report funds sent to an anchor but not reflected in-app, reconcile via
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
  affected.
- If caused by an anchor-side breaking change, add a contract/schema check to detect that
  class of change earlier.
