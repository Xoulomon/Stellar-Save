# Pre-commit Hook Bypass Policy

## Overview

The pre-commit hook runs two checks on every commit:

1. **Lint / format** — ESLint, Prettier, and Stylelint on staged files.
2. **Secret scan** — Gitleaks scans staged changes against `.gitleaks.toml`.

See [docs/secret-scanning.md](secret-scanning.md) for details on the secret
scan, including install instructions and rule set documentation.

## How to Bypass

In **emergency** situations only (production hotfix, CI infrastructure
failure), you can bypass all pre-commit hooks:

```bash
git commit --no-verify -m "hotfix: description"
```

## When Bypass Is Acceptable

- **Production hotfix**: A critical bug requires an immediate deploy.
- **CI outage**: The lint tools or gitleaks are broken or unavailable and the
  change is provably free of secrets.
- **Dependency conflict**: A transient issue prevents the tools from running.

## When Bypass Is NOT Acceptable

- "I'll fix it later" — fix lint issues before committing.
- "It's just a small change" — small changes can still leak secrets.
- "The linter is wrong" — file an issue and disable the specific rule inline.
- "It's just a test file" — test files have leaked production credentials before.

## After Bypass

- **Lint bypass**: the bypassed commit **must** be followed up with a cleanup
  commit resolving all lint and formatting issues within 24 hours.
- **Secret scan bypass**: if the commit contained a real secret, rotate the
  credential immediately and remove it from git history before the branch is
  pushed. If you bypassed because gitleaks was unavailable and the change is
  secret-free, file a follow-up issue and resolve it within 24 hours.
