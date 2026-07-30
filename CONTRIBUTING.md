# Contributing to Stellar-Save

Thank you for your interest in contributing to Stellar-Save. This document explains how to get involved, what standards to follow, and how to submit your work.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Conventions](#commit-message-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)

---

## Code of Conduct

By participating in this project, you agree to treat all contributors with respect. We do not tolerate harassment, discrimination, or hostile behaviour of any kind. If you experience or witness a violation, please open a private issue or contact a maintainer directly.

---

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)
- [Node.js](https://nodejs.org/) v18+ and npm
- [Freighter wallet](https://www.freighter.app/) (for manual testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Install frontend dependencies
cd frontend
npm install

# Build the smart contract
cd ../contracts/stellar-save
cargo build --target wasm32-unknown-unknown --release
```

### Branching

Always branch from `main`:

```bash
git checkout main
git pull origin main
git checkout -b your-branch-name
```

Use descriptive branch names:

- `fix/contribution-overflow`
- `docs/api-reference`
- `feat/custom-tokens`

> **Note:** Avoid using `feature/` as a prefix — use `feat/` instead to prevent directory conflicts on some remotes.

---

## Formatting Policy

All TypeScript, JavaScript, JSON, CSS, and Markdown files in this repo are
formatted with [Prettier](https://prettier.io/). A single shared config lives
at the **root `.prettierrc`** and applies to both the `frontend/` workspace and
any other JS/TS tooling files. There is no per-workspace override.

### Config summary

| Option          | Value      | Reason                                                 |
| --------------- | ---------- | ------------------------------------------------------ |
| `printWidth`    | `100`      | Readable on modern displays without excessive wrapping |
| `singleQuote`   | `true`     | Consistent with existing TypeScript codebase style     |
| `trailingComma` | `"es5"`    | Cleaner diffs; valid in all ES5+ environments          |
| `semi`          | `true`     | Explicit semicolons reduce ambiguity                   |
| `tabWidth`      | `2`        | Matches `.editorconfig` for JS/TS files                |
| `endOfLine`     | `"lf"`     | Cross-platform consistency                             |
| `arrowParens`   | `"always"` | Consistent syntax regardless of param count            |

### Running the formatter

```bash
# From the repo root — format everything
npm run format:all

# Check formatting without writing (CI mode)
npm run format:all:check

# Format only frontend source files
npm run format

# From inside frontend/
npm run format
npm run format:check
```

### Pre-commit hook

A Git pre-commit hook (`.husky/pre-commit`) automatically runs
[lint-staged](https://github.com/okonet/lint-staged) before every commit.
It formats **only the staged files** matching `*.{ts,tsx,js,jsx,json,css,md}`,
then re-stages them. This means you never need to run the formatter manually.

The hook is installed automatically when you run `npm install` at the repo root.

To bypass in an emergency (must be justified in the PR):

```bash
git commit --no-verify -m "chore: emergency fix — formatter bypass documented in PR"
```

### CI check

The `.github/workflows/format-check.yml` workflow runs
`npm run format:all:check` on every push and pull request. A PR with
unformatted files will be blocked from merging.

### Files excluded from formatting

See `.prettierignore` for the full list. Key exclusions:

- `**/node_modules/`, `dist/`, `target/` — generated/installed output
- `package-lock.json`, `Cargo.lock` — machine-managed lock files
- `**/test_snapshots/` — auto-generated test snapshot files
- `frontend/tsconfig.node.json` — contains trailing-comma JSON not parseable by Prettier

### Adding a new workspace

If a new workspace (e.g. `backend/`) is added that has JS/TS files:

1. Do **not** create a local `.prettierrc` — the root config applies automatically
2. Add any workspace-specific ignore patterns to `.prettierignore`
3. Update the `format` and `format:check` glob patterns in the root `package.json`
   if the new workspace files are not already covered by `**/*.{ts,tsx,...}`

---

## Code Style Guidelines

### Rust (Smart Contract)

- Follow standard Rust formatting — run `cargo fmt` before committing
- Run `cargo clippy` and resolve all warnings before opening a PR
- Keep functions small and focused — one responsibility per function
- Use descriptive variable names; avoid single-letter names outside of iterators
- Document public functions with `///` doc comments
- Prefer `Result<T, ContractError>` over panics for recoverable errors
- Group related logic into modules (see existing `contribution.rs`, `payout.rs`, etc.)

```rust
/// Verifies that the caller is the group creator.
/// Returns an error if the caller is not authorised.
pub fn require_creator(env: &Env, group: &Group) -> Result<(), ContractError> {
    let caller = env.invoker();
    if caller != group.creator {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}
```

### TypeScript / React (Frontend)

- Use functional components with hooks — no class components
- Type all props and state with TypeScript interfaces or types
- Use `const` by default; only use `let` when reassignment is needed
- Keep components small — extract sub-components when a file exceeds ~150 lines
- Co-locate component CSS files (e.g. `Button.tsx` + `Button.css`)
- Use semantic HTML elements for accessibility (`<button>`, `<nav>`, `<main>`, etc.)
- Run `npm run lint` before committing

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const Button = ({ label, onClick, disabled = false }: ButtonProps) => (
  <button onClick={onClick} disabled={disabled} className="btn">
    {label}
  </button>
);
```

---

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type       | When to use                                 |
| ---------- | ------------------------------------------- |
| `feat`     | A new feature                               |
| `fix`      | A bug fix                                   |
| `docs`     | Documentation changes only                  |
| `style`    | Formatting, whitespace (no logic change)    |
| `refactor` | Code restructuring without behaviour change |
| `test`     | Adding or updating tests                    |
| `chore`    | Build process, dependency updates, tooling  |

### Examples

```
feat(contract): add custom token support for contributions

fix(frontend): correct payout position display off-by-one error

docs: add contributing guidelines

test(contract): add edge case tests for missed contribution handling
```

### Rules

- Use the imperative mood in the description: "add" not "added" or "adds"
- Keep the first line under 72 characters
- Reference issues in the footer: `Closes #42`

---

## Pull Request Process

1. **Open an issue first** for non-trivial changes so the approach can be discussed before you invest time coding
2. **Branch from `main`** — never commit directly to `main`
3. **Keep PRs focused** — one feature or fix per PR; avoid bundling unrelated changes
4. **Fill in the PR template** — describe what changed, why, and how to test it
5. **Ensure CI passes** — all tests must pass before a review is requested
6. **Request a review** from at least one maintainer
7. **Address review comments** — push follow-up commits to the same branch; do not force-push after review has started
8. **Squash on merge** — maintainers will squash commits when merging to keep history clean

### PR Title

Follow the same Conventional Commits format as commit messages:

```
feat(contract): implement penalty for missed contributions
```

---

## Testing Requirements

### Smart Contract (Rust)

- All new public functions must have at least one unit test
- Cover both the happy path and expected error cases
- Use `#[should_panic]` or `assert_eq!(result, Err(...))` for error cases
- Run the full test suite before opening a PR:

```bash
cargo test
```

- Snapshot tests live in `test_snapshots/` — update them if your change affects output

### Frontend (TypeScript / React)

- Add tests for any new utility functions or hooks
- Component tests are encouraged but not yet required for all components
- Run the linter before committing:

```bash
npm run lint
```

### General

- Do not reduce overall test coverage — PRs that delete tests without replacement will be rejected
- If you find a bug, write a failing test that reproduces it before fixing it

---

## Questions?

Open a [GitHub Discussion](https://github.com/Xoulomon/Stellar-Save/discussions) or comment on the relevant issue. We're happy to help you get your contribution across the line.
