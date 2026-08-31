# Quarantined Mobile E2E Tests

This directory contains tests that have been temporarily quarantined due to
known flakiness. Quarantined tests are **skipped in CI** until fixed.

## How It Works

1. `quarantined_tests.txt` — one test filename (relative to `.maestro/`) per line.
2. `scripts/run-tests.sh` reads this file and excludes those flows.
3. The CI workflow runs `quarantine-report.sh` to post a summary of quarantined tests.

## Quarantine a Test

```bash
echo ".maestro/flaky_flow.yaml" >> mobile/quarantine/quarantined_tests.txt
git commit -m "test(mobile): quarantine flaky_flow until #123 is fixed"
```

Include a comment explaining *why* the test is quarantined and link to the tracking issue:

```
# QUARANTINED: flaky on Android emulator due to animation timing — see #123
.maestro/flaky_flow.yaml
```

## Unquarantine a Test

Remove its line from `quarantined_tests.txt` and open a PR.

## Policy

- A test should not stay quarantined for more than **2 sprint cycles**.
- If a fix cannot be found, the test should be rewritten or removed.
- The CI quarantine report job will **warn** (not fail) when quarantined tests exist.
