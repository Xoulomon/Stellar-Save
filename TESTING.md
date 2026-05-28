# Testing Guide

## Overview

This project uses a comprehensive testing strategy including:
- **Unit tests** for smart contracts (Rust) and frontend (TypeScript)
- **Property-based testing** (fuzzing) for contracts
- **Code coverage** tracking with 95% threshold for contracts
- **Mutation testing** to verify test suite quality

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

- Component tests: `src/**/*.test.tsx`
- Utility tests: `src/**/*.test.ts`
- Setup file: `src/test/setup.ts`

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

## CI/CD Integration

Add to your CI pipeline:

```yaml
# Smart contracts
- run: cargo test --workspace

# Frontend
- run: cd frontend && npm install && npm test run
```

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

