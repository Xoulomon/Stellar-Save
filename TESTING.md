# Testing Guide

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

## Test Boundary — Unit vs Integration (Rust contracts)

Tests in `contracts/stellar-save/src/` follow a strict unit/integration boundary
documented in [`backend/test/TESTING_BOUNDARY.md`](backend/test/TESTING_BOUNDARY.md).

**Rule of thumb:**
- **Unit tests** (in each `*.rs` module) — test pure logic, data structures, and
  validation rules with no storage reads/writes
- **Integration tests** (`payout_executor.rs`) — test storage persistence wiring:
  correct key used, correct value written, round-trip reads

Overlap audit results are in [`backend/test/AUDIT.md`](backend/test/AUDIT.md).

