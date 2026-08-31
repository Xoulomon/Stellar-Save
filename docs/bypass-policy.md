# Pre-commit Hook Bypass Policy

## Overview

The pre-commit hook runs ESLint, Prettier, and Stylelint on staged files to
prevent lint violations and formatting issues from reaching code review.

## How to Bypass

In **emergency** situations only (production hotfix, CI infrastructure
failure), you can bypass the pre-commit hook:

```bash
git commit --no-verify -m "hotfix: description"
```

## When Bypass Is Acceptable

- **Production hotfix**: A critical bug requires an immediate deploy
- **CI outage**: The lint tools themselves are broken or unavailable
- **Dependency conflict**: A transient issue prevents the tools from running

## When Bypass Is NOT Acceptable

- "I'll fix it later" — fix lint issues before committing
- "It's just a small change" — small changes can still introduce issues
- "The linter is wrong" — file an issue instead; disable the specific rule inline

## After Bypass

Any bypassed commit **must** be followed up with a cleanup commit that
resolves all lint and formatting issues within 24 hours.
