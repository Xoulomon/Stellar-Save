# Performance Tests

The k6 load and performance scenarios for the Stellar-Save API live in
[`backend/tests/load`](../../backend/tests/load/README.md). This directory is the
entry point for them from the repository root.

| Scenario | Path | Purpose |
|---|---|---|
| Concurrent deposits | `backend/tests/load/concurrent-deposits.js` | General concurrent deposit load; asserts final balances |
| Deadline contributions | `backend/tests/load/deadline-contributions.js` | Concurrent contributions near a cycle deadline (highest contention) |
| Groups | `backend/tests/load/groups.test.js` | Group list, filter and detail read throughput |
| Auth | `backend/tests/load/auth.test.js` | Auth challenge and verify throughput |
| Analytics | `backend/tests/load/analytics.test.js` | Analytics dashboard read throughput |

Shared helpers are in `backend/tests/load/balance-assertions.js` and
`backend/tests/load/config.js` (`BASE_URL` and default `loadOptions`).

Install k6 and follow the prerequisites in `backend/tests/load/README.md` before running
any scenario. Scenarios target a running backend or staging API, never production.
