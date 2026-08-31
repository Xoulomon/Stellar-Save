# Runbook: OnChainAdminAction

**Alert:** `OnChainAdminAction`
**Severity:** Warning
**Metric:** `on_chain_alerts_total{alert_type="ADMIN_ACTION"}`

## What happened

A `pause_group`, `unpause_group`, or other admin-privileged contract call was detected on-chain.

## Immediate response

1. **Verify the action was intentional.** Check with the team member who has admin key access.
2. Check the event details — tx hash and caller address — against your known admin keys:
   ```
   GET /api/v1/events?eventType=admin_action&limit=5
   ```
3. If the admin key is **unknown or unexpected**, treat this as a key compromise. Follow the [key-compromise runbook](./key-compromise.md) immediately.

## Resolution

- If intentional: acknowledge the alert and document the reason in the incident log.
- If unexpected: revoke admin key, rotate credentials, and initiate incident response.

---

## Complete Admin-Gated Function Reference (Issue #1329)

For the full audited function table see `docs/admin-actions.md`.

### Contract-Admin Functions

| Function | Auth Guard | Notes |
|---|---|---|
| `update_config` | `config.admin.require_auth()` | Updates global contract config |
| `migrate_storage` | `caller.require_auth()` + identity check | Manual schema migration |
| `update_contribution_limits` | `admin.require_auth()` + identity check | Updates global min/max |
| `add_allowed_token` | `admin.require_auth()` + identity check | Adds token to allowlist |
| `remove_allowed_token` | `admin.require_auth()` + identity check | Removes token from allowlist |

### Group-Creator Functions

| Function | Auth Guard | Notes |
|---|---|---|
| `pause_group` | `caller.require_auth()` + creator check | Halts contributions & payouts |
| `resume_group` | `caller.require_auth()` + creator check | Resumes after pause |
| `cancel_group` | `caller.require_auth()` + creator check | Irreversible terminal state |
| `update_group_metadata` | `caller.require_auth()` + creator check | Name/description/image |
| `assign_payout_positions` | `caller.require_auth()` + creator check | Rotation order |
| `set_penalty_config` | `caller.require_auth()` + creator check | Per-group penalty rates |
| `extend_deadline` | `caller.require_auth()` + creator check | Extends cycle deadline |
| `set_invitation_only` | `creator.require_auth()` | Toggles invite-only mode |

Authorization tests for all functions above are in `contracts/stellar-save/src/admin_actions_tests.rs`.
