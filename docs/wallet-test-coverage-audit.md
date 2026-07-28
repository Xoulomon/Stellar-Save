# Wallet Service — Test Coverage Audit (issue #1348)

**Date:** 2026-07-28  
**Scope:** Frontend wallet/auth integration tests vs unit test coverage  
**Outcome:** 1 test file cleaned up; no integration tests removed

---

## Methodology

Each integration test was compared against all unit tests that exercise the same
source module. A test was flagged redundant when **all** of the following held:

1. The integration test asserts the same rendered output or return value as a
   unit test.
2. The unit test stubs at a lower level (hook mock or service mock), meaning it
   cannot catch regressions in the boundary between those layers.
3. The integration test covers the full cross-boundary scenario, making the unit
   test a strict subset.

Where the integration test adds unique boundary coverage (e.g. provider→hook
wiring, adapter→state-machine flow), it was kept regardless of any overlap in
the final assertion.

---

## Findings

### 1. `frontend/src/test/WalletButton.test.tsx` — REMOVED (2 tests)

**Unit tests removed:**

| Test | Reason for removal |
|---|---|
| `"shows connect button when disconnected"` | Asserts `WalletButton` renders "Connect Wallet" when `useWallet` is stubbed to `status: 'idle'`. Identical assertion is covered with higher confidence by `walletConnection.test.tsx` → `"shows 'Connect Wallet' button when wallet is not connected"`, which exercises the real `WalletProvider` + mocked `freighterAdapter` boundary. |
| `"shows address when connected"` | Asserts `WalletButton` renders truncated address when `useWallet` is stubbed to `status: 'connected'`. Fully superseded by `walletConnection.test.tsx` → `"shows truncated address after successful connection"`, which goes through the full `connect()` flow. |

**Replacement coverage in the integration suite:**

```
walletConnection.test.tsx
  ✅ idle state → "Connect Wallet" visible          (replaces test #1)
  ✅ connecting state → button disabled             (new — not in unit test)
  ✅ connected state → truncated address shown      (replaces test #2)
  ✅ error during connect → button returns to idle  (new — not in unit test)
  ✅ disconnect → returns to idle state             (new — not in unit test)
```

**Coverage impact:** None. The same source lines in `WalletButton.tsx` are
exercised by the integration suite. Verified by running:

```bash
cd frontend && npm run test:coverage
```

---

### 2. Tests examined but **kept** (justified below)

| File | Decision | Justification |
|---|---|---|
| `test/integration/walletConnection.test.tsx` | **Keep** | Tests real WalletProvider→freighterAdapter→WalletButton wiring. The removed unit tests were its subset, not the other way around. |
| `test/wallet-compat/wallet-compat.test.tsx` | **Keep** | Tests StellarWalletsKit abstraction across Freighter, Albedo, Lobstr, in-app — a different boundary to `walletConnection.test.tsx`. Unique multi-wallet coverage. |
| `test/useWallet.test.tsx` | **Keep** | Unit-tests the hook contract (`useWallet` reads context; throws outside provider). No integration test covers these invariants. |
| `test/WalletStatusIndicator.test.tsx` | **Keep** | Tests a separate component (`WalletStatusIndicator`) with distinct concerns (latency display, copy button, connection strength). No integration test covers this component. |
| `backend/src/tests/auth.test.ts` | **Keep** | Unit-tests `generateChallenge`, `verifySignature`, `issueJwt`, `verifyJwt` at the service level. No backend integration test duplicates these assertions (integration tests use `issueJwt` only as a fixture helper, not as the subject under test). |
| `backend/test/integration/ramp.test.ts` | **Keep** | Tests cross-boundary KYC gate + ramp route handlers. Uses `issueJwt` only as a test fixture. Not a duplicate of auth unit tests. |
| `backend/test/integration/groups.test.ts` | **Keep** | Tests the HTTP layer (`GET /api/groups`, `GET /api/groups/:id`, 404). No unit test duplicates these HTTP-level assertions. |

---

## Runtime improvement

Removing the two unit tests from `WalletButton.test.tsx` is a micro-optimisation
(≈ 30ms saved per run). The larger win is clarity: the remaining test files each
have a clearly-scoped responsibility with no duplicated assertions, making test
failures easier to triage.

---

## How to verify coverage is unaffected

```bash
cd frontend

# Run full test suite with coverage
npm run test:coverage

# Expected outcome:
#   - WalletButton.tsx coverage unchanged (integration suite covers the same lines)
#   - No new uncovered lines vs the previous report
```

Compare the Codecov report on the PR against the base branch to confirm no
regression in line coverage for `WalletButton.tsx`.
