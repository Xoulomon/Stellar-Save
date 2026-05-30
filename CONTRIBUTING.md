# Contributing to Stellar-Save

Thank you for your interest in contributing to Stellar-Save — a decentralized ROSCA (Rotating Savings and Credit Association) built on Stellar Soroban smart contracts.

This guide covers everything you need to get started: environment setup, coding standards, testing requirements, and the PR process.

> New to the project? Start with [docs/first-time-contributor.md](docs/first-time-contributor.md) for a gentler walkthrough.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture Overview](#architecture-overview)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Message Conventions](#commit-message-conventions)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Drips Wave Contributions](#drips-wave-contributions)
- [Getting Help](#getting-help)

---

## Code of Conduct

By participating in this project you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). We do not tolerate harassment, discrimination, or hostile behaviour. Report violations by opening a private issue or contacting a maintainer directly.

---

## Architecture Overview

Stellar-Save has four main layers:

```
User (Stellar wallet)
       │
       ▼
Frontend (React + TypeScript + Vite)
       │
       ▼
Soroban Smart Contracts (Rust)
       │
       ▼
Stellar Network (on-chain storage + Horizon API)
```

**Smart contract modules** (`contracts/stellar-save/src/`):

| Module | Responsibility |
|---|---|
| `lib.rs` | Contract entry points and public API |
| `group.rs` | Group creation and configuration |
| `contribution.rs` | Contribution logic and tracking |
| `payout.rs` / `payout_executor.rs` | Payout rotation and distribution |
| `storage.rs` | On-chain data layout |
| `security.rs` | Authorization and access control |
| `error.rs` | Typed error variants |
| `events.rs` | Soroban event emission |

**Frontend** (`frontend/src/`): React 19 + TypeScript SPA using MUI, React Router, and `@stellar/stellar-sdk`.

For full architecture details see [docs/architecture.md](docs/architecture.md).

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | 1.81.0 (pinned) | [rustup.rs](https://rustup.rs) |
| Soroban / Stellar CLI | latest | [Stellar CLI docs](https://developers.stellar.org/docs/tools/stellar-cli) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | bundled with Node.js |

The Rust toolchain version is pinned in `rust-toolchain.toml`. Running any `cargo` command will install it automatically via rustup.

### Clone and install

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Install root-level tooling (commitlint, husky)
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Environment configuration

```bash
cp .env.example .env
```

Edit `.env` with your network settings. Available networks are defined in `environments.toml`:

- `testnet` — Stellar testnet (recommended for development)
- `futurenet` — Stellar futurenet
- `standalone` — Local development node
- `mainnet` — Production (do not use for development)

### Build the smart contract

```bash
./scripts/build.sh
# or directly:
cargo build --target wasm32-unknown-unknown --release
```

### Run the frontend dev server

```bash
cd frontend
npm run dev
```

### Deploy to testnet

```bash
# Generate a testnet identity (one-time)
stellar keys generate deployer --network testnet

# Deploy
./scripts/deploy_testnet.sh
```

---

## Project Structure

```
Stellar-Save/
├── contracts/
│   └── stellar-save/        # Main ROSCA smart contract (Rust)
│       └── src/             # Contract modules
├── frontend/                # React + TypeScript SPA
│   └── src/
├── client/                  # Rust client library
├── scripts/                 # Build, deploy, and test scripts
├── docs/                    # Project documentation
├── tests/                   # Integration and shell tests
├── infra/                   # Terraform infrastructure
├── monitoring/              # Prometheus / Grafana / ELK configs
├── .github/workflows/       # CI/CD pipelines
├── Cargo.toml               # Workspace manifest
├── environments.toml        # Network configurations
└── rust-toolchain.toml      # Pinned Rust version
```

---

## Coding Standards

### Rust (smart contract)

- Run `cargo fmt` before every commit — formatting is enforced in CI
- Run `cargo clippy -- -D warnings` and fix all warnings before opening a PR
- Keep functions small and single-purpose
- Use descriptive names; avoid single-letter variables outside iterators
- Document all public items with `///` doc comments
- Prefer `Result<T, ContractError>` over panics for recoverable errors
- Use the typed error variants in `error.rs` — do not add bare `panic!` calls

```rust
/// Verifies the caller is the group creator.
///
/// # Errors
/// Returns [`ContractError::Unauthorized`] if the caller is not the creator.
pub fn require_creator(env: &Env, group: &Group) -> Result<(), ContractError> {
    let caller = env.invoker();
    if caller != group.creator {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}
```

### TypeScript / React (frontend)

- Use functional components with hooks — no class components
- Type all props and state with TypeScript interfaces or types; avoid `any`
- Use `const` by default; `let` only when reassignment is necessary
- Keep components under ~150 lines; extract sub-components when they grow larger
- Use semantic HTML for accessibility (`<button>`, `<nav>`, `<main>`, etc.)
- Run `npm run lint` before committing — ESLint is enforced in CI

Prettier config (`.prettierrc`):
- Single quotes, semicolons, trailing commas (ES5), 100-char print width, 2-space indent

```tsx
interface ContributionCardProps {
  amount: bigint;
  member: string;
  isPaid: boolean;
}

const ContributionCard = ({ amount, member, isPaid }: ContributionCardProps) => (
  <article className="contribution-card">
    <span>{member}</span>
    <span>{isPaid ? '✓' : 'Pending'}</span>
  </article>
);
```

### General

- `.editorconfig` is present — use an editor that respects it (UTF-8, LF line endings, final newline)
- Do not commit secrets, private keys, or `.env` files — `.gitignore` covers common cases but double-check before staging

---

## Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/). Commits are validated by commitlint via a Husky `commit-msg` hook.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `refactor` | Code restructuring without behaviour change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling |
| `ci` | CI/CD configuration changes |
| `revert` | Reverting a previous commit |

### Rules

- Use imperative mood: "add" not "added" or "adds"
- Keep the subject line under 100 characters
- Reference issues in the footer: `Closes #42`
- Use `feat!` or add `BREAKING CHANGE:` in the footer for breaking changes

### Examples

```
feat(contract): add penalty mechanism for missed contributions

fix(frontend): correct off-by-one in payout position display

docs: expand contributing guide with architecture overview

test(contract): add fuzz tests for contribution overflow edge cases

chore: update soroban-sdk to 23.0.3
```

---

## Testing Requirements

### Running the Full Test Suite Locally

Before opening a PR, run all tests to ensure nothing is broken:

```bash
# Run all tests (contract + frontend)
./scripts/test.sh

# Or run individually:
# Contract tests
cargo test --workspace

# Frontend tests
cd frontend && npm test run
```

### Smart Contract Tests (Rust)

All new public functions must have tests covering:
- The happy path
- Expected error cases (use `assert_eq!(result, Err(ContractError::...))`)
- Edge cases (boundary values, empty inputs, etc.)

**Run contract tests:**

```bash
# All contracts
cargo test --workspace

# Stellar-save contract only
cargo test -p stellar-save

# With stdout output (see println! output)
cargo test -- --nocapture

# Single test
cargo test test_contribute_success

# With backtrace on failure
RUST_BACKTRACE=1 cargo test

# With coverage (requires cargo-tarpaulin)
cargo tarpaulin --config contracts/stellar-save/tarpaulin.toml
```

**Test structure:**

```rust
#[test]
fn test_contribute_success() {
    let env = Env::default();
    let contract = create_contract(&env);
    
    // Setup
    let group_id = contract.create_group(1000, 30, 100);
    let member = Address::random(&env);
    contract.join_group(group_id, member.clone(), None);
    
    // Execute
    let result = contract.contribute(group_id, member.clone(), 1000);
    
    // Assert
    assert!(result.is_ok());
}

#[test]
fn test_contribute_insufficient_balance() {
    let env = Env::default();
    let contract = create_contract(&env);
    
    // Setup
    let group_id = contract.create_group(1000, 30, 100);
    let member = Address::random(&env);
    contract.join_group(group_id, member.clone(), None);
    
    // Execute & Assert
    let result = contract.contribute(group_id, member.clone(), 500);
    assert_eq!(result, Err(ContractError::InsufficientBalance));
}
```

**Test snapshots:**

Test snapshots live in `contracts/stellar-save/test_snapshots/`. Update them if your change intentionally affects output:

```bash
# Update snapshots
cargo test -- --nocapture --test-threads=1 -- --exact test_name
```

### Frontend Tests (TypeScript)

Add tests for new utility functions and hooks. Component tests are encouraged.

**Run frontend tests:**

```bash
cd frontend

# Watch mode (development)
npm test

# Single run (CI)
npm run test:run

# With coverage
npm run test:coverage

# Accessibility checks (jest-axe / vitest-axe)
npm run test:a11y

# Visual regression tests (Percy)
npm run test:visual

# Mutation testing (Stryker)
npm run test:mutation
```

**Test structure:**

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContractCall } from './useContractCall';

describe('useContractCall', () => {
  it('should fetch group data successfully', async () => {
    const { result } = renderHook(() => useContractCall('get_group', [123]));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.data).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => useContractCall('invalid_method', []));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    expect(result.current.error).toBeDefined();
  });
});
```

**Test files location:**

Test files live alongside source files:
- `src/hooks/useContractCall.ts` → `src/hooks/useContractCall.test.ts`
- `src/components/GroupCard.tsx` → `src/components/GroupCard.test.tsx`

Setup is in `src/test/setup.ts`.

### Backend Tests (if applicable)

```bash
# Run backend tests
npm test src/tests/indexer.test.ts

# With coverage
npm test -- --coverage
```

### General Testing Rules

- ✅ Do not reduce overall test coverage — PRs that delete tests without replacement will be rejected
- ✅ If you find a bug, write a failing test that reproduces it before fixing it
- ✅ CI must be green before requesting review
- ✅ Aim for >80% code coverage on new code
- ✅ Test both success and failure paths
- ✅ Use descriptive test names: `test_contribute_with_insufficient_balance` not `test_1`

### CI/CD Pipeline

All tests run automatically on:
- **Pull requests** — must pass before merge
- **Push to main** — must pass before deployment
- **Scheduled** — nightly runs for extended test suites

View CI status in GitHub Actions tab.

---

## Pull Request Process

### Branch Naming Conventions

Always branch from `main` and use descriptive names following this format:

```
<type>/<description>
```

| Type | Use for | Example |
|---|---|---|
| `feat/` | New feature | `feat/penalty-mechanism` |
| `fix/` | Bug fix | `fix/wallet-timeout` |
| `docs/` | Documentation | `docs/contributing-guide` |
| `refactor/` | Code restructuring | `refactor/storage-layout` |
| `test/` | Tests only | `test/payout-edge-cases` |
| `perf/` | Performance | `perf/gas-optimization` |
| `chore/` | Tooling, deps | `chore/update-soroban-sdk` |

**Example workflow:**

```bash
# Create and switch to new branch
git checkout main && git pull origin main
git checkout -b feat/penalty-mechanism

# Make changes, commit, push
git add .
git commit -m "feat(contract): implement penalty for missed contributions"
git push -u origin feat/penalty-mechanism
```

### PR Title Format

Follow Conventional Commits format:

```
<type>(<scope>): <description>
```

**Examples:**
- `feat(contract): implement penalty for missed contributions`
- `fix(frontend): resolve wallet connection timeout on mobile`
- `docs: expand contributing guide with development workflow`
- `test(contract): add fuzz tests for contribution overflow`

### PR Description Template

Fill in all sections:

```markdown
## Description
Brief summary of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Performance improvement
- [ ] Breaking change

## How to Test
Step-by-step instructions to verify the changes

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### PR Process Steps

1. **Open an issue first** for non-trivial changes — discuss the approach before investing time coding
2. **Create a branch** from `main` using naming conventions above
3. **Keep PRs focused** — one feature or fix per PR; avoid bundling unrelated changes
4. **Fill in the PR template** completely — describe what changed, why, and how to test it
5. **Ensure CI passes** — all checks must be green before requesting review
6. **Request a review** from at least one maintainer
7. **Address review comments** — push follow-up commits to the same branch; do not force-push after review has started
8. **Squash on merge** — maintainers squash commits when merging to keep history clean

### Code Review Guidelines

**For reviewers:**
- Check that tests are comprehensive
- Verify code follows style guidelines
- Ensure commit messages are clear
- Test locally if possible

**For authors:**
- Respond to all comments
- Push fixes as new commits (don't amend)
- Request re-review after addressing feedback
- Be respectful and collaborative

---

## Drips Wave Contributions

Stellar-Save participates in **Drips Wave** — a contributor funding program. Funded issues are labelled `wave-ready` on GitHub and categorised by effort:

| Label | Points | Examples |
|---|---|---|
| `trivial` | 100 | Documentation fixes, simple tests, minor UI copy |
| `medium` | 150 | Helper functions, validation logic, moderate features |
| `high` | 200 | Core features, complex integrations, security enhancements |

### How to Claim a Wave-Ready Issue

1. **Find an issue** labeled `wave-ready` on [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues?q=label%3Awave-ready)
2. **Comment on the issue** to claim it:
   ```
   I'd like to work on this issue. I'll submit a PR by [date].
   ```
3. **Create a branch** following naming conventions (see [Branch Naming Conventions](#branch-naming-conventions))
4. **Work on the issue** — follow all coding standards and testing requirements
5. **Open a PR** with a clear description and link to the issue
6. **Get reviewed** — address feedback from maintainers
7. **Merge** — once approved, your PR will be merged
8. **Claim funding** — follow instructions in [docs/wave-guide.md](docs/wave-guide.md)

### Wave-Ready Issue Categories

**Trivial (100 points)** — Good for first-time contributors
- Documentation improvements
- Simple test additions
- Minor UI/UX fixes
- Code comment improvements
- Example code

**Medium (150 points)** — Intermediate difficulty
- Helper functions and utilities
- Validation logic
- Moderate feature additions
- Performance improvements
- Bug fixes with moderate complexity

**High (200 points)** — Advanced contributors
- Core feature implementations
- Complex integrations
- Security enhancements
- Major refactoring
- Performance optimizations

### Tips for Wave-Ready Issues

- ✅ Start with `trivial` issues to get familiar with the codebase
- ✅ Read the issue description carefully — it contains specific requirements
- ✅ Ask questions in the issue comments if anything is unclear
- ✅ Follow all coding standards and testing requirements
- ✅ Write clear commit messages and PR descriptions
- ✅ Be responsive to review feedback
- ✅ One issue per PR — don't bundle multiple issues

### Funding Process

After your PR is merged:

1. Verify your PR is merged to `main`
2. Follow the instructions in [docs/wave-guide.md](docs/wave-guide.md)
3. Submit your claim with:
   - GitHub username
   - PR link
   - Issue number
   - Points claimed
4. Receive funding via Drips protocol

See [docs/wave-guide.md](docs/wave-guide.md) for detailed funding instructions.

---

## Getting Help

- **GitHub Issues** — bug reports and feature requests
- **GitHub Discussions** — questions, ideas, and general conversation
- **Telegram** — [@Xoulomon](https://t.me/Xoulomon) for quick questions

If you are unsure whether your idea fits the project, open a Discussion before writing code. We are happy to help you get your contribution across the line.
