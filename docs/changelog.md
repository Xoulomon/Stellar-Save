# Changelog Generation

CHANGELOG.md is auto-generated from commit messages following the [Conventional Commits](https://www.conventionalcommits.org/) spec.

## Commit message format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

| Type | Description | Changelog section |
|---|---|---|
| `feat` | New feature | Features |
| `fix` | Bug fix | Bug Fixes |
| `perf` | Performance improvement | Performance |
| `revert` | Revert a commit | Reverts |
| `docs` | Documentation only | — |
| `style` | Formatting, no logic change | — |
| `refactor` | Code restructure, no feature/fix | — |
| `test` | Adding/updating tests | — |
| `chore` | Build process, tooling | — |
| `ci` | CI configuration | — |

Only `feat`, `fix`, `perf`, and `revert` appear in the changelog by default.

### Breaking changes

Add `BREAKING CHANGE:` in the footer, or append `!` after the type:

```
feat!: remove deprecated contribute() overload

BREAKING CHANGE: the two-argument form of contribute() is removed.
```

## Local usage

```bash
# Install dependencies (once)
npm install

# Generate / update CHANGELOG.md from all commits
npm run changelog

# First-time full history generation
npm run changelog:first
```

## Release workflow

Pushing a version tag triggers `.github/workflows/changelog.yml`:

1. Generates / updates `CHANGELOG.md`
2. Extracts the section for the new tag
3. Creates a GitHub Release with those notes
4. Commits the updated `CHANGELOG.md` back to `main`

```bash
git tag v1.1.0
git push origin v1.1.0
```

## Commit enforcement

- **Local**: husky `commit-msg` hook runs commitlint before every commit
- **CI**: `.github/workflows/commitlint.yml` lints all commits in a PR

To bypass in exceptional cases (not recommended):

```bash
git commit --no-verify -m "..."
```
