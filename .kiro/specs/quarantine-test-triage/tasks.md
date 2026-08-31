# Implementation Plan

## Overview

Fix the misleading `mobile/quarantine/README.md` by adding a "Current Status" section and a "Triage Review Log" table that document all six Maestro flows as healthy and the quarantine list as empty. This is a documentation-only change — no scripts, flow YAMLs, or `quarantined_tests.txt` are modified.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - README Implies Outstanding Triage Work
  - **CRITICAL**: This test MUST FAIL on the unfixed README — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the README when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface concrete evidence that the unfixed README misleads contributors about the quarantine state
  - **Scoped Inspection Approach**: The bug condition is deterministic (a static document), so scope the check to the three concrete failing cases below
  - Check 1 — No empty-state declaration: Read `mobile/quarantine/README.md` and confirm it contains no sentence equivalent to "the quarantine list is currently empty" or "no tests are currently quarantined"
  - Check 2 — No triage log: Confirm the unfixed README contains no audit record (table or list) for any of the six flows: `smoke`, `onboarding`, `wallet_creation`, `contribute`, `create_group`, `join_group`
  - Check 3 — CI vs README mismatch: Run `mobile/scripts/quarantine-report.sh` and confirm it prints "✅ No quarantined mobile E2E tests." while the README provides no reconciling statement explaining why that is the case
  - Run all three checks against the UNFIXED README
  - **EXPECTED OUTCOME**: All three checks find the unfixed content — confirming the misleading framing exists
  - Document counterexamples found (e.g., "No 'Current Status' section found", "No triage table found", "No 'empty' or 'no quarantined' text found in README")
  - Mark task complete when checks are written, run, and all three failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation inspection tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Scripts and Flow Files Behave Identically Before and After Fix
  - **IMPORTANT**: Follow observation-first methodology — record current behavior on the unfixed codebase before any changes are made
  - Observe and record: Run `mobile/scripts/run-tests.sh` with the empty `quarantined_tests.txt` and note that it reports "Quarantined: 0 test(s)" and lists all six flows for execution
  - Observe and record: Run `mobile/scripts/quarantine-report.sh` and note that it exits 0 and prints "✅ No quarantined mobile E2E tests."
  - Observe and record: Confirm the `echo ".maestro/flaky_flow.yaml" >>` quarantine pattern is present in the unfixed README
  - Observe and record: Confirm `mobile/.maestro/config.yaml` contains `retryOnFailure: 2`, `defaultTimeout: 10000`, `screenshotsOnFailure: true`
  - Observe and record: Note the file hashes or content of all six flow YAML files (`smoke.yaml`, `onboarding.yaml`, `wallet_creation.yaml`, `contribute.yaml`, `create_group.yaml`, `join_group.yaml`)
  - Write inspection assertions capturing these five observed behaviors so they can be re-verified after the fix
  - Run all assertions against the UNFIXED codebase
  - **EXPECTED OUTCOME**: All assertions PASS on the unfixed code (confirms the preservation baseline)
  - Mark task complete when assertions are written, run, and confirmed passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix: Update README to reflect empty quarantine state and triage outcomes

  - [ ] 3.1 Implement the README update
    - Open `mobile/quarantine/README.md`
    - Add a "Current Status" section immediately below the title (`# Quarantined Mobile E2E Tests`) with an explicit statement that the quarantine list is currently empty, all six Maestro flows are active in the main suite, and a formal triage review has been completed
    - Add a "Triage Review Log" section containing a table with one row per flow covering: flow name, coverage description, verdict (Healthy), and notes — use the six entries from the design document
    - Update the introductory paragraph to make clear that the quarantine mechanism exists for future use and is not currently active, rather than implying it is in active use
    - Retain all existing policy content unchanged: "How It Works", "Quarantine a Test", "Unquarantine a Test", and "Policy" sections must remain intact
    - Do NOT modify `run-tests.sh`, `quarantine-report.sh`, `quarantined_tests.txt`, `config.yaml`, or any flow YAML file
    - _Bug_Condition: isBugCondition(input) where input.action = READ_QUARANTINE_README AND quarantinedTestsCount = 0 AND README_implies_outstanding_triage_work = true_
    - _Expected_Behavior: README contains explicit empty-quarantine statement, triage log for all six flows with verdicts, and updated introductory framing_
    - _Preservation: run-tests.sh, quarantine-report.sh, quarantined_tests.txt, config.yaml, and all six flow YAMLs must remain byte-for-byte identical_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.2 Verify README inspection checklist (bug condition exploration test now passes)
    - **Property 1: Expected Behavior** - README Accurately Reflects Empty Quarantine State
    - **IMPORTANT**: Re-run the SAME three checks from task 1 against the FIXED README — do NOT write new checks
    - The checks from task 1 encode the expected behavior; when they pass, the fix is confirmed
    - Check 1: Confirm the fixed README contains an explicit statement that the quarantine list is currently empty (or equivalent phrasing)
    - Check 2: Confirm the fixed README contains a triage log entry for each of the six flows (`smoke`, `onboarding`, `wallet_creation`, `contribute`, `create_group`, `join_group`) with flow name, coverage, verdict, and notes
    - Check 3: Confirm `quarantine-report.sh` output ("✅ No quarantined mobile E2E tests.") is now reconciled by the README's "Current Status" section
    - **EXPECTED OUTCOME**: All three checks PASS (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation assertions still pass (no regressions)
    - **Property 2: Preservation** - Scripts and Flow Files Behave Identically Before and After Fix
    - **IMPORTANT**: Re-run the SAME five assertions from task 2 against the post-fix codebase — do NOT write new assertions
    - Assertion 1 (Req 3.1, 3.4): Run `mobile/scripts/run-tests.sh` with the empty `quarantined_tests.txt` — confirm it still reports "Quarantined: 0 test(s)" and includes all six flows
    - Assertion 2 (Req 3.3): Run `mobile/scripts/quarantine-report.sh` — confirm it still exits 0 and prints "✅ No quarantined mobile E2E tests."
    - Assertion 3 (Req 3.2): Confirm the fixed README still contains the `echo ".maestro/flaky_flow.yaml" >>` quarantine pattern
    - Assertion 4 (Req 3.5): Confirm `mobile/.maestro/config.yaml` is unchanged (`retryOnFailure: 2`, `defaultTimeout: 10000`, `screenshotsOnFailure: true`)
    - Assertion 5 (Req 3.4): Confirm all six flow YAML files are byte-for-byte identical to the baseline recorded in task 2
    - **EXPECTED OUTCOME**: All five assertions PASS (confirms no regressions introduced by the README-only change)

- [ ] 4. Checkpoint — Ensure all checks pass
  - Re-run the bug condition exploration checks from task 1 (via task 3.2) and confirm all three pass
  - Re-run the preservation assertions from task 2 (via task 3.3) and confirm all five pass
  - Perform a final human-readable review of `mobile/quarantine/README.md`: confirm it states the quarantine list is empty and all flows are active, contains a triage log entry for each of the six flows with flow name/coverage/verdict/notes, still contains the "Quarantine a Test" instructions, and still contains the "Policy" section
  - Confirm `quarantined_tests.txt`, `run-tests.sh`, `quarantine-report.sh`, `config.yaml`, and all six flow YAMLs are unmodified
  - Ask the user if any questions or ambiguities arise before closing the fix

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3.1"] },
    { "wave": 3, "tasks": ["3.2", "3.3"] },
    { "wave": 4, "tasks": ["4"] }
  ]
}
```

Tasks 1 and 2 are independent and can be executed in parallel. Task 3.1 depends on both being complete. Task 4 is the final gate.

## Notes

- This is a documentation-only fix. The only file that changes is `mobile/quarantine/README.md`.
- Property-based testing does not apply here because the "function under test" is a static document, not an executable function with a parameterizable input domain (see design.md — Testing Strategy section).
- Tasks 1 and 2 use inspection-based checks and script smoke tests as the closest analogue to property verification for a documentation target.
- The six flows confirmed healthy by the triage audit: `smoke.yaml`, `onboarding.yaml`, `wallet_creation.yaml`, `contribute.yaml`, `create_group.yaml`, `join_group.yaml`.
