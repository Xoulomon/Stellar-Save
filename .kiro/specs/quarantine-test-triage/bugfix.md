# Bugfix Requirements Document

## Introduction

The `mobile/quarantine/README.md` describes a quarantine mechanism for flaky mobile E2E tests
and implies that tests have been pulled out of the main Maestro suite pending triage. In
reality, `mobile/quarantine/quarantined_tests.txt` is empty — no tests are currently listed.
This mismatch creates a false impression of outstanding triage work and misleads contributors
about the state of the mobile test suite.

The fix involves:
1. Formally auditing every Maestro flow in `mobile/.maestro/` to confirm its health and
   quarantine status.
2. Restoring any salvageable tests (none currently quarantined, but the process must be
   validated).
3. Deleting any obsolete tests that duplicate coverage or test removed features.
4. Updating `quarantined_tests.txt` and `README.md` so they accurately reflect the post-triage
   state (currently: zero quarantined tests, all flows active and healthy).

**Affected files:**
- `mobile/quarantine/quarantined_tests.txt` — the list of quarantined flows
- `mobile/quarantine/README.md` — the policy and process description
- `mobile/.maestro/*.yaml` — the Maestro E2E flow files

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a contributor reads `mobile/quarantine/README.md` THEN the system implies that one or
more tests have been quarantined and are awaiting triage, even though
`quarantined_tests.txt` contains zero entries.

1.2 WHEN `mobile/scripts/quarantine-report.sh` is run in CI THEN the system prints
"✅ No quarantined mobile E2E tests." which contradicts the README's framing that
quarantine triage is outstanding work.

1.3 WHEN a developer attempts to triage quarantined tests by inspecting
`quarantined_tests.txt` THEN the system provides no entries, no failure reasons, and no
actionable information, making the task impossible to complete as described.

1.4 WHEN the mobile E2E suite is reviewed for completeness THEN the system has no documented
record of whether any of the six active Maestro flows (`smoke`, `onboarding`,
`wallet_creation`, `contribute`, `create_group`, `join_group`) were ever quarantined and
subsequently restored, or were always in the main suite.

### Expected Behavior (Correct)

2.1 WHEN a contributor reads `mobile/quarantine/README.md` THEN the system SHALL accurately
state that the quarantine list is currently empty and all known Maestro flows are active in
the main suite.

2.2 WHEN `mobile/scripts/quarantine-report.sh` is run in CI THEN the system SHALL continue to
print "✅ No quarantined mobile E2E tests." and the README SHALL be consistent with that
output.

2.3 WHEN a developer reviews the quarantine directory after triage THEN the system SHALL
provide a record (in the README or a triage log) confirming that each of the six active
Maestro flows has been reviewed, deemed healthy, and is correctly placed in the main suite.

2.4 WHEN any of the six active flows (`smoke`, `onboarding`, `wallet_creation`, `contribute`,
`create_group`, `join_group`) is found to duplicate coverage or test a removed feature
during triage THEN the system SHALL have that flow deleted and the deletion documented.

2.5 WHEN a salvageable flow is identified during triage THEN the system SHALL have that flow
restored to the main suite, passing, and removed from `quarantined_tests.txt`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `mobile/scripts/run-tests.sh` is executed with an empty `quarantined_tests.txt`
THEN the system SHALL CONTINUE TO run all six active Maestro flows without skipping any.

3.2 WHEN a new test needs to be quarantined in the future THEN the system SHALL CONTINUE TO
support adding it to `quarantined_tests.txt` using the documented `echo` command pattern.

3.3 WHEN `mobile/scripts/quarantine-report.sh` is executed THEN the system SHALL CONTINUE TO
exit with code 0 regardless of whether the quarantine list is empty or non-empty.

3.4 WHEN a flow file exists in `mobile/.maestro/` and is not listed in
`quarantined_tests.txt` THEN the system SHALL CONTINUE TO include that flow in the CI
test run.

3.5 WHEN `mobile/.maestro/config.yaml` is read by the Maestro runner THEN the system SHALL
CONTINUE TO apply the global `retryOnFailure: 2`, `defaultTimeout: 10000`, and
`screenshotsOnFailure: true` settings to all flows.
