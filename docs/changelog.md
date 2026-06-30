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
3. Prepends human-readable highlights from `docs/releases/<tag>.md` (if present)
4. Creates a GitHub Release combining highlights + generated changelog
5. Commits the updated `CHANGELOG.md` back to `main`

```bash
# Optional: write highlights before tagging
cp docs/release-notes-template.md docs/releases/v1.1.0.md
# Edit docs/releases/v1.1.0.md with your highlights
git add docs/releases/v1.1.0.md && git commit -m "docs: add highlights for v1.1.0"

git tag v1.1.0
git push origin v1.1.0
```

### Human-readable highlights

Before tagging a release, copy `docs/release-notes-template.md` to `docs/releases/vX.Y.Z.md` and fill in:

- **Highlights** — 3–5 bullet points describing user-visible changes in plain language
- **Upgrade notes** — any migration steps, env-var changes, or breaking-change remediation

If no highlights file exists the release notes fall back to the raw generated changelog.

## Commit enforcement

- **Local**: husky `commit-msg` hook runs commitlint before every commit
- **CI**: `.github/workflows/commitlint.yml` lints all commits in a PR

To bypass in exceptional cases (not recommended):

```bash
git commit --no-verify -m "..."
```
