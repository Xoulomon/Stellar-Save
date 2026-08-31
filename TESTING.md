# Testing Guide

## Overview

This project uses a comprehensive testing strategy including:
- **Unit tests** for smart contracts (Rust) and frontend (TypeScript)
- **Property-based testing** (fuzzing) for contracts
- **Code coverage** tracking with 95% threshold for contracts
- **Mutation testing** to verify test suite quality

---

## Shared Stellar SDK Mock

A shared manual mock for `@stellar/stellar-sdk` eliminates live network calls and
removes the need for ad-hoc inline mocks in individual test files.

### Why a shared mock?

Without a shared mock, each test file that touches the Stellar SDK would either:
1. Make real HTTP calls to Horizon / Soroban RPC — making tests slow and flaky.
2. Duplicate an inline `jest.mock(…, () => ({ … }))` factory — hard to keep in sync.

The shared mock ensures all unit tests are **offline-first**, **deterministic**, and
**consistent** across the codebase.

### Mock file locations

| Workspace | File | Test framework |
|-----------|------|----------------|
| Frontend  | `frontend/src/__mocks__/@stellar/stellar-sdk.ts` | Vitest (`vi.fn`) |
| Backend   | `backend/src/__mocks__/@stellar/stellar-sdk.ts`  | Jest (`jest.fn`) |

Both mocks mirror the same `@stellar/stellar-sdk` API surface:
- `Keypair` (static factories + instance methods)
- `Networks` (passphrase constants)
- `Asset` (native + custom)
- `TransactionBuilder` (builder pattern)
- `Operation` (payment, changeTrust, setOptions, …)
- `Contract` / `Address`
- `Horizon.Server` (loadAccount, submitTransaction, payments, transactions)
- `SorobanRpc.Server` / `rpc.Server` (getAccount, simulateTransaction, sendTransaction, …)
- Helper functions: `nativeToScVal`, `scValToNative`, `xdr`

### Using the shared mock (frontend — Vitest)

Add a single `vi.mock()` call at the top of your test file; Vitest picks up the
shared mock automatically — no factory argument needed.

```typescript
// src/hooks/__tests__/useSomething.test.ts
import { vi, describe, it, expect } from 'vitest';

// This one line activates the shared mock.
// See frontend/src/__mocks__/@stellar/stellar-sdk.ts for the full stub surface.
vi.mock('@stellar/stellar-sdk');

describe('useSomething', () => {
  it('fetches balance without hitting the network', async () => {
    // All Horizon.Server / SorobanRpc.Server methods return pre-configured
    // stubs. No real RPC endpoint is called.
    const { Horizon } = await import('@stellar/stellar-sdk');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    expect(server.loadAccount).toBeDefined();
  });
});
```

**Overriding a specific stub per test:**

```typescript
vi.mock('@stellar/stellar-sdk');

it('handles loadAccount failure', async () => {
  const { Horizon } = await import('@stellar/stellar-sdk');
  (Horizon.Server as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
    loadAccount: vi.fn().mockRejectedValueOnce(new Error('network error')),
  }));
  // … test body
});
```

**Using the helper factories:**

```typescript
import { makeMockHorizonServer, FAKE_ACCOUNT_ID } from
  '../__mocks__/@stellar/stellar-sdk';

const server = makeMockHorizonServer();
server.loadAccount.mockResolvedValueOnce({
  id: FAKE_ACCOUNT_ID,
  balances: [{ asset_type: 'native', balance: '50.0000000' }],
  sequence: '1',
});
```

**When you need the real SDK (rare):**

```typescript
const realSdk = await vi.importActual('@stellar/stellar-sdk');
```

### Using the shared mock (backend — Jest)

```typescript
// src/tests/somethingService.test.ts
import { SorobanClientPool } from '../lib/soroban';

// This one line activates the shared mock.
// See backend/src/__mocks__/@stellar/stellar-sdk.ts for the full stub surface.
jest.mock('@stellar/stellar-sdk');

describe('SorobanClientPool', () => {
  it('creates clients without a live RPC endpoint', () => {
    const pool = new SorobanClientPool({ rpcUrl: 'http://localhost', poolSize: 2 });
    expect(pool.metrics().total).toBe(2);
  });
});
```

**Overriding a specific stub per test:**

```typescript
jest.mock('@stellar/stellar-sdk');

it('retries on RPC failure', async () => {
  const { rpc } = require('@stellar/stellar-sdk');
  (rpc.Server.prototype.getAccount as jest.Mock).mockRejectedValueOnce(
    new Error('connection refused')
  );
  // … test body
});
```

**Using the helper factories:**

```typescript
import { makeMockRpcServer, FAKE_ACCOUNT_ID } from
  '../__mocks__/@stellar/stellar-sdk';

const server = makeMockRpcServer();
server.sendTransaction.mockResolvedValueOnce({ status: 'ERROR', hash: '', errorResult: 'bad_auth' });
```

**When you need the real SDK (e.g. signing in auth tests):**

```typescript
// auth.test.ts — intentionally uses real Keypair for cryptographic signing
import { Keypair } from '@stellar/stellar-sdk';
// Do NOT call jest.mock('@stellar/stellar-sdk') in this file.
const keypair = Keypair.random(); // real Ed25519 key
```

### Which tests intentionally use the real SDK

| File | Reason |
|------|--------|
| `backend/src/tests/auth.test.ts` | Needs real `Keypair.sign()` / `Keypair.verify()` to test the challenge–response auth flow |
| `frontend/src/test/e2e-testnet/testnet.e2e.ts` | E2E tests submit real transactions to Stellar testnet |
| `frontend/e2e/rosca-journey.spec.ts` | Playwright E2E — hits a running app, not a unit test |

All other tests that touch `@stellar/stellar-sdk` **must** use the shared mock.

---

## Smart Contract Tests (Rust)

### Running Tests

```bash
# Run all contract tests
cargo test --workspace

# Run tests for specific contract
cargo test -p guess-the-number
cargo test -p fungible-allowlist-example
cargo test -p nft-enumerable-example

# Run with output
cargo test -- --nocapture
```

### Test Structure

- Tests use Soroban SDK's `testutils` for mocking and assertions
- Each contract has tests in either `src/test.rs` or `tests/test.rs`
- Tests include mock auth, address generation, and cross-contract calls

---

## Frontend Tests (Vitest + React Testing Library)

### Setup

```bash
cd frontend
npm install
```

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test run

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Test Structure

| Directory | Purpose |
|-----------|---------|
| `src/test/` | Component and hook unit tests |
| `src/hooks/__tests__/` | Hook-specific unit tests (using shared Stellar mock) |
| `src/test/e2e-testnet/` | Testnet E2E tests (real SDK, real network) |
| `src/__mocks__/@stellar/` | Shared Vitest manual mocks |

### Writing Tests

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Fake timers: required pattern for any delay-dependent test

Never let a test depend on a real delay. A real `setTimeout` plus `waitFor`
passes locally and fails intermittently on a loaded CI runner, because
`waitFor` can exhaust its polling budget before the timer fires. Drive the
clock explicitly instead.

```ts
it('shows the latency badge once the request resolves', async () => {
  vi.useFakeTimers();
  mockFetch.mockImplementation(
    () => new Promise((resolve) => {
      setTimeout(() => resolve({ ok: true }), 100);
    }),
  );

  try {
    render(<MyComponent />);

    // Assert the pre-timer state so the advance is proven to be what changes it.
    expect(screen.queryByText(/ms/)).not.toBeInTheDocument();

    // Advance the exact mocked duration and flush the resolved promise.
    await vi.advanceTimersByTimeAsync(100);

    expect(screen.getByText(/ms/)).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
```

Rules:

- Use `await vi.advanceTimersByTimeAsync(ms)`, not the synchronous
  `advanceTimersByTime`, whenever a promise resolves inside the timer. The
  async form flushes the microtask queue that the callback schedules.
- Assert the state before and after the advance. A test that only asserts the
  final state cannot distinguish a working timer from an immediate resolution.
- Restore real timers in a `finally` block or `afterEach`. A leaked fake clock
  silently breaks every later test in the file.
- Do not mix `waitFor` with fake timers. If the wait is timer-driven, advance
  the clock; `waitFor` polls on the same clock you just froze.
- With `userEvent`, pass the shim: `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
  Without it, user interactions hang on a frozen clock.

Reference implementation: the connection-strength badge test in
`frontend/src/test/WalletStatusIndicator.test.tsx`.

---

## Backend Tests (Jest + ts-jest)

### Running Tests

```bash
cd backend
npm test                    # all unit tests
npm run test:integration    # integration tests (requires Docker)
```

### Test Structure

| Directory | Config | Purpose |
|-----------|--------|---------|
| `src/tests/` | `jest.config.js` | Unit tests (default run) |
| `test/unit/` | `jest.config.js` | Additional unit tests |
| `test/integration/` | `jest.integration.config.js` | Integration tests |
| `src/__mocks__/@stellar/` | — | Shared Jest manual mocks |

### Jest version

The backend uses **Jest 29** with **ts-jest 29** (ts-jest 30 is not yet released).
The `package.json` `devDependencies` lock this at:
```json
{
  "jest": "^29.7.0",
  "ts-jest": "^29.4.9"
}
```

If tests fail with `TypeError: this._moduleMocker.clearMocksOnScope is not a function`,
the installed jest version is 30. Fix by running:
```bash
cd backend && pnpm install jest@29.7.0 --save-dev
```

---

## CI/CD Integration

```yaml
# Smart contracts
- run: cargo test --workspace

# Frontend
- run: cd frontend && npm install && npm test run

# Backend
- run: cd backend && npm test
```

---

## Test Runtime Measurements (Stellar SDK Mock)

These measurements were taken to verify the impact of the shared Stellar SDK mock
(issue #1334 / #84). All tests run without live network calls.

### Frontend (Vitest)

| Metric | Baseline (2026-07-29) |
|--------|-----------------------|
| Total test files | 122 |
| Tests | 840 |
| Duration | ~226 s |
| Stellar SDK live network calls | 0 (all via shared mock) |

The 60 failing tests are **pre-existing failures** unrelated to the Stellar SDK mock
(component rendering mismatches, missing module mocks for unrelated dependencies).
The `useTransaction` and `useBalance` hooks that use `@stellar/stellar-sdk` pass fully.

### Backend (Jest)

| Metric | Baseline (2026-07-29) |
|--------|-----------------------|
| Key Stellar SDK test: `soroban_pool.test.ts` | PASS (10/10 tests, ~4.6 s) |
| Key Stellar SDK test: `transaction-decoder.test.ts` | PASS via shared mock |
| Live Soroban RPC calls | 0 (all via shared mock) |

The backend has pre-existing test failures in modules that are not related to Stellar
SDK mocking (TypeScript type errors, empty test suites, missing environment variables
for non-Stellar services such as Redis, S3, Elasticsearch).

### Runtime benefit

Before the shared mock was introduced, any test touching `@stellar/stellar-sdk` would
either fail immediately (no network in CI) or wait for real RPC timeouts (~5–30 s per
test file). With the shared mock:

- Each RPC call resolves in **< 1 ms** (in-process stub).
- Tests that previously needed network access are now **fully offline**.
- No flakiness from network latency or testnet congestion.

---

## Mutation Testing

Mutation testing verifies the quality of your test suite by introducing small changes (mutations) to the code and checking if tests catch them. A high mutation score indicates that tests effectively detect bugs.

### What is Mutation Testing?

Mutation testing works by:
1. Creating "mutants" — small modifications to your code (e.g., changing `>` to `>=`, `+` to `-`)
2. Running your test suite against each mutant
3. Checking if tests fail (mutant "killed") or pass (mutant "survived")
4. Calculating a mutation score: `killed / (killed + survived) × 100%`

A surviving mutant indicates either:
- Missing test coverage for that code path
- Tests that don't assert the specific behavior being mutated

### Rust Contracts (cargo-mutants)

**Installation:**
```bash
cargo install cargo-mutants --locked
```

**Running locally:**
```bash
cd contracts/stellar-save

# Run all mutations (can take 30-60 minutes)
cargo mutants

# Run with parallelism
cargo mutants --jobs 4

# Test specific files only
cargo mutants --file src/penalty.rs --file src/pool.rs

# Show caught mutants (for debugging)
cargo mutants --caught
```

**Configuration:**
- Config file: `contracts/stellar-save/mutants.toml`
- Excludes: test files, benchmarks, migrations, generated code
- Timeout: 120s per mutant (3x multiplier)
- Target threshold: 60% mutation score

**Interpreting results:**
```
Mutation score: 75.0% (45/60 mutants killed)
  caught: 45    ← tests detected these mutations ✓
  missed: 15    ← tests didn't catch these (need more tests)
  timeout: 0    ← mutants that caused infinite loops
  unviable: 5   ← mutants that don't compile (skipped)
```

**Adding tests for surviving mutants:**

When a mutant survives, examine the mutation and add a test:

```rust
// Example: mutant changed `amount > 0` to `amount >= 0`
// Surviving mutant in penalty.rs:
//   - if amount <= 0 { return 0; }
//   + if amount < 0 { return 0; }

// Add test to catch this:
#[test]
fn test_calculate_penalty_zero_amount() {
    let cfg = PenaltyConfig::default();
    // This test now catches the >= vs > mutation
    assert_eq!(calculate_penalty(0, 3, &cfg), 0);
}
```

### Frontend (Stryker)

**Installation:**
```bash
cd frontend
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
```

**Running locally:**
```bash
cd frontend

# Run all mutations (can take 20-40 minutes)
npm run test:mutation

# View HTML report
open reports/mutation/mutation.html
```

**Configuration:**
- Config file: `frontend/stryker.config.mjs`
- Excludes: test files, assets, i18n, type definitions
- Thresholds: 80% (high), 60% (low), 50% (break/fail)
- Concurrency: 4 workers

**Interpreting results:**
```
Mutation score: 68.5% (137/200 mutants killed)
  Killed: 137       ← tests caught these ✓
  Survived: 63      ← tests missed these (need assertions)
  No coverage: 12   ← code not executed by tests
  Timeout: 3        ← mutants caused infinite loops
```

**Adding tests for surviving mutants:**

```typescript
// Example: mutant changed `amount > 0` to `amount >= 0`
// Surviving mutant in utils/validation.ts

// Add test to catch this:
it('rejects zero amount', () => {
  expect(validateAmount(0)).toBe(false);
  // This assertion now catches the > vs >= mutation
});
```

### CI Integration

Mutation testing runs automatically:
- **On PRs** to main/develop (for changed files only)
- **Weekly** (Sunday 03:00 UTC) for full baseline
- **Manual trigger** via GitHub Actions (can select scope: all/contracts/frontend)

**Workflow:** `.github/workflows/mutation-testing.yml`

**Thresholds enforced in CI:**
- Contracts: 60% minimum mutation score
- Frontend: 50% minimum mutation score

**PR comments:**
The workflow automatically posts mutation scores as PR comments with:
- Overall score and emoji indicator (🟢 ≥80%, 🟡 ≥60%, 🔴 <60%)
- Breakdown of killed/survived/timeout mutants
- List of surviving mutants (expandable)
- Link to full HTML report in artifacts

### Best Practices

1. **Start with high-value modules**: Focus mutation testing on critical business logic (penalty calculations, pool math, contribution validation)

2. **Don't chase 100%**: Some mutants are equivalent (produce identical behavior) or test implementation details. Aim for 70-85% on critical modules.

3. **Use mutation testing to find gaps**: Surviving mutants reveal:
   - Missing edge case tests
   - Assertions that are too weak
   - Dead code that can be removed

4. **Combine with coverage**: High line coverage + high mutation score = robust test suite

5. **Run incrementally**: Use `--file` (cargo-mutants) or `mutate` patterns (Stryker) to test specific modules during development

6. **Review timeouts**: Mutants that timeout often indicate:
   - Missing loop termination checks
   - Unbounded recursion guards
   - Performance-critical code paths

### Troubleshooting

**cargo-mutants is slow:**
- Use `--jobs N` to parallelize
- Use `--file` to test specific modules
- Increase `--timeout` if legitimate tests are timing out

**Stryker uses too much memory:**
- Reduce `concurrency` in `stryker.config.mjs`
- Use `--mutate` CLI flag to test specific files
- Exclude large generated files

**False positives (equivalent mutants):**
- Some mutants produce identical behavior (e.g., `i++` vs `++i` in some contexts)
- Document these in code comments or ignore patterns
- Focus on the overall trend, not individual mutants

**CI timeout:**
- Mutation testing is CPU-intensive; adjust `timeout-minutes` in workflow
- Consider running full suite only on schedule, not every PR

### Resources

- [cargo-mutants documentation](https://mutants.rs/)
- [Stryker documentation](https://stryker-mutator.io/)
- [Mutation testing explained](https://en.wikipedia.org/wiki/Mutation_testing)
