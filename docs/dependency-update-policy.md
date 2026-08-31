# Dependency Update Policy

Automated dependency updates are managed by [Dependabot](https://docs.github.com/en/code-security/dependabot) and a companion auto-merge workflow.

## Schedule

All ecosystems are checked every **Monday at 06:00 UTC**.

| Ecosystem | Directory | Label |
|-----------|-----------|-------|
| npm (frontend) | `/frontend` | `dependencies`, `frontend` |
| npm (backend) | `/backend` | `dependencies`, `backend` |
| Cargo | `/` | `dependencies`, `rust` |
| GitHub Actions | `/` | `dependencies`, `github-actions` |

## Update Types

### Patch & Minor — Auto-merged
When Dependabot opens a PR for a patch or minor version bump:

1. The `Dependabot Auto-merge` workflow runs the full test suite (frontend vitest, backend tests, Cargo tests).
2. If all tests pass, the PR is automatically squash-merged.
3. No human review is required.

### Major — Manual review required
Major version bumps are labelled `major-update` and `needs-review` and left open for a maintainer to:

- Review the upstream changelog / migration guide.
- Update any breaking API usage.
- Approve and merge manually.

## Grouping Rules

Related packages are batched into a single PR to reduce noise:

**Frontend**
- `stellar-sdk` — `@stellar/*`, `stellar-sdk`
- `mui` — `@mui/*`, `@emotion/*`
- `testing` — `@testing-library/*`, `vitest`, `@vitest/*`, `playwright`
- `vite-tooling` — `vite`, `@vitejs/*`, `typescript`, `eslint*`
- `react` — `react`, `react-dom`, `react-*`, `@types/react*`

**Backend**
- `stellar-sdk` — `@stellar/*`, `stellar-sdk`
- `graphql` — `graphql*`, `@apollo/*`, `@graphql-tools/*`
- `dev-dependencies` — all devDependencies

**Cargo**
- `soroban` — `soroban-*`, `stellar-*`

**GitHub Actions**
- All actions grouped into one PR per week.

## Security Updates

Dependabot also opens security PRs immediately (outside the weekly schedule) for any vulnerability advisory. These follow the same auto-merge rules: patch/minor are merged automatically after tests pass; major bumps require manual review.

## Repository Setup

For auto-merge to work, enable the following in **Settings → General**:

- ✅ Allow auto-merge
- ✅ Automatically delete head branches

The workflow uses `GITHUB_TOKEN` — no additional secrets are needed.

## Commit Message Convention

| Ecosystem | Prefix |
|-----------|--------|
| npm (prod deps) | `chore(deps): …` |
| npm (dev deps) | `chore(dev-deps): …` |
| Cargo | `chore(deps): …` |
| GitHub Actions | `chore(ci): …` |
