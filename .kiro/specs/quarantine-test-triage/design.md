# Quarantine Test Triage Bugfix Design

## Overview

The `mobile/quarantine/README.md` describes a quarantine mechanism for flaky Maestro E2E
tests and implies that triage work is outstanding. In reality, `quarantined_tests.txt` is
empty — no tests have been pulled from the main suite. The mismatch misleads contributors
into thinking there are broken or pending tests that need attention.

The fix is a documentation and housekeeping change, not a code change:

1. **Audit** all six active Maestro flows for correctness and relevance.
2. **Delete** any flow found to be obsolete or duplicating coverage (the audit may find
   none).
3. **Update** `mobile/quarantine/README.md` to reflect the current empty-quarantine state
   and record the triage outcome for each flow.

No changes to `run-tests.sh`, `quarantine-report.sh`, `quarantined_tests.txt`, or
`config.yaml` are required because those files already behave correctly.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a contributor reads the
  quarantine README and receives a false impression that triage work is outstanding when
  the quarantine list is empty and all flows are active.
- **Property (P)**: The desired state after the fix — the README accurately describes the
  current post-triage status: zero quarantined tests, six healthy flows in the main suite.
- **Preservation**: The scripts (`run-tests.sh`, `quarantine-report.sh`), the flow YAML
  files, `config.yaml`, and `quarantined_tests.txt` must be functionally unchanged by the
  fix. The quarantine mechanism must continue to work for future use.
- **Triage**: The deliberate review of every Maestro flow to classify it as healthy (keep
  in main suite), fixable (quarantine temporarily), or obsolete (delete).
- **`run-tests.sh`**: The shell script at `mobile/scripts/run-tests.sh` that runs all
  flows in `mobile/.maestro/` while skipping any listed in `quarantined_tests.txt`.
- **`quarantine-report.sh`**: The shell script at `mobile/scripts/quarantine-report.sh`
  that prints a CI summary of quarantined flows; always exits 0.
- **Active flow**: A Maestro YAML file in `mobile/.maestro/` that is not listed in
  `quarantined_tests.txt` and therefore runs in CI.

---

## Bug Details

### Bug Condition

The bug manifests when a contributor opens `mobile/quarantine/README.md`. The README uses
present-tense language ("Quarantined tests are skipped in CI until fixed", "How to
quarantine a test") with no statement that the quarantine list is currently empty. This
creates a false impression of outstanding triage work even though:
- `quarantined_tests.txt` contains only comments, no active entries.
- `quarantine-report.sh` prints "✅ No quarantined mobile E2E tests." in CI.
- All six flows run in every CI execution.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type ContributorAction
  OUTPUT: boolean

  RETURN input.action = READ_QUARANTINE_README
         AND quarantinedTestsCount(quarantined_tests.txt) = 0
         AND README_implies_outstanding_triage_work(mobile/quarantine/README.md)
END FUNCTION
```

### Examples

- **Example 1 — Contributor reads README**: A new contributor sees the README header
  "Quarantined Mobile E2E Tests" and the "How It Works" section. They assume they should
  look for tests to triage. Actual: `quarantined_tests.txt` is empty — there is nothing
  to triage.

- **Example 2 — CI output vs README**: CI prints "✅ No quarantined mobile E2E tests."
  A developer cross-references the README and finds no explanation reconciling the two.
  They do not know whether the quarantine mechanism has been abandoned or is simply idle.

- **Example 3 — Onboarding a new team member**: A new engineer is asked to "review the
  quarantine status." The README implies a multi-step process (read the file, check the
  issues, fix or remove). Actual: there is nothing to review, but the README provides no
  way to discover that quickly.

- **Edge case — Future quarantine**: A future developer quarantines a test correctly via
  the documented `echo` pattern. After the fix, the README must still accurately describe
  how to use the quarantine mechanism — it should not be removed, only updated.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- `mobile/scripts/run-tests.sh` with an empty `quarantined_tests.txt` SHALL continue to
  run all six active Maestro flows and exit 0 when all pass (Requirements 3.1, 3.4).
- `mobile/scripts/quarantine-report.sh` SHALL continue to exit 0 and print
  "✅ No quarantined mobile E2E tests." when `quarantined_tests.txt` is empty
  (Requirement 3.3).
- The `echo "..." >> quarantined_tests.txt` pattern for adding future quarantined tests
  SHALL remain valid and documented (Requirement 3.2).
- `mobile/.maestro/config.yaml` global settings (`retryOnFailure: 2`,
  `defaultTimeout: 10000`, `screenshotsOnFailure: true`) SHALL remain unchanged
  (Requirement 3.5).
- All six flow YAML files SHALL remain functionally unchanged unless a flow is
  determined to be obsolete during the audit (in which case deletion is the correct
  action per Requirement 2.4).

**Scope:**

All inputs that do NOT involve reading or editing `mobile/quarantine/README.md` are
completely unaffected by this fix. In particular:

- The CI run behaviour for the six active flows is unchanged.
- The quarantine mechanism scripts are unchanged.
- Application source code is untouched.

---

## Hypothesized Root Cause

The bug is a documentation drift caused by the README being written in advance as a
policy document before any tests were ever quarantined, and never being updated to
reflect the current (empty) state. Specifically:

1. **README written for the general case, not the current state**: The README describes
   the quarantine mechanism as if it is actively in use. It has no "current status"
   section that would be kept in sync with `quarantined_tests.txt`.

2. **No triage record exists**: The README instructs contributors to quarantine and
   unquarantine tests, but there is no log or record showing that all six flows were
   formally audited and confirmed healthy at any point. The absence of such a record
   makes it impossible to distinguish "triage completed, everything is healthy" from
   "triage never happened."

3. **No explicit empty-state messaging**: Neither the README nor `quarantined_tests.txt`
   contains a statement like "Last triage: all flows reviewed on [date], none
   quarantined." The `quarantined_tests.txt` contains only example comments, which adds
   to the ambiguity.

4. **Six flows with undocumented audit history**: The flows `smoke`, `onboarding`,
   `wallet_creation`, `contribute`, `create_group`, and `join_group` all exist in the
   main suite with no documentation of whether they were reviewed for continued
   relevance against the current application.

---

## Correctness Properties

Property 1: Bug Condition — README Accurately Reflects Empty Quarantine State

_For any_ contributor action where the bug condition holds (isBugCondition returns true —
the contributor reads `mobile/quarantine/README.md` while `quarantined_tests.txt` is
empty), the fixed README SHALL clearly and unambiguously communicate that the quarantine
list is currently empty, all six Maestro flows are active in the main suite, and a formal
triage review has been completed with documented findings for each flow.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Quarantine Mechanism Remains Functional

_For any_ input where the bug condition does NOT hold (a developer uses the quarantine
mechanism as designed — adding, running with, or removing a quarantined test), the fixed
README and supporting files SHALL produce exactly the same observable behavior as before
the fix, preserving the `echo`-to-quarantine workflow, the CI skip behavior in
`run-tests.sh`, and the quarantine-report summary format.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

The fix consists of a single file update (the README). No scripts, flow YAMLs, or
`quarantined_tests.txt` require modification.

**File**: `mobile/quarantine/README.md`

**Specific Changes**:

1. **Add a "Current Status" section at the top** (below the title): State explicitly
   that the quarantine list is empty and all flows are active. Reference the triage
   review date so the information is time-stamped.

2. **Add a "Triage Review Log" section**: Document each of the six flows with its name,
   a brief description of what it covers, its verdict (healthy / obsolete), and any
   notes. This satisfies Requirement 2.3 and provides an audit trail for future
   contributors.

   | Flow | Coverage | Verdict | Notes |
   |------|----------|---------|-------|
   | `smoke.yaml` | Critical paths: onboarding entry, wallet create entry, tab navigation, create group form, browse & join entry | Healthy | Broad fast-check of key UI paths; no duplication |
   | `onboarding.yaml` | Welcome screen, Get Started CTA, wallet-connect prompt, back navigation | Healthy | Dedicated depth test for onboarding; complements smoke |
   | `wallet_creation.yaml` | Full wallet creation: generate seed phrase, backup confirmation, seed verification, dashboard navigation | Healthy | Only flow covering seed phrase backup and verify steps |
   | `contribute.yaml` | Group contribution: group detail, contribute CTA, amount confirmation, transaction modal, success modal | Healthy | Only flow covering the contribution transaction path |
   | `create_group.yaml` | Group creation form: all fields, submit, transaction modal, success, group detail navigation | Healthy | Only flow covering full group creation form submission |
   | `join_group.yaml` | Browse, search, group preview, join modal, membership confirmation, group detail navigation | Healthy | Only flow covering the join-group path |

3. **Update introductory framing**: Replace or augment the opening paragraph to make
   clear that the quarantine mechanism exists for future use and is not currently active,
   rather than implying it is in active use.

4. **Retain all existing policy content**: The "How It Works", "Quarantine a Test",
   "Unquarantine a Test", and "Policy" sections must remain intact and unchanged because
   they document valid future-use instructions (Requirement 3.2).

5. **Delete obsolete flows if found**: The triage review above found all six flows to
   be healthy. No deletions are required. If a future audit finds an obsolete flow,
   the deletion should be documented in the triage log.

---

## Testing Strategy

### Validation Approach

This fix is a documentation change. The testing strategy focuses on verifying that the
README content is internally consistent, that the scripts continue to behave correctly
with an empty quarantine list, and that the quarantine mechanism remains usable.

Because the "function under test" is human-readable documentation rather than executable
code, validation takes the form of inspection-based checks and script smoke tests rather
than unit or property-based tests.

---

### Exploratory Bug Condition Checking

**Goal**: Confirm the bug exists on the unfixed README by demonstrating that a reader
receives a false impression of outstanding triage work.

**Test Plan**: Read `mobile/quarantine/README.md` and check whether it contains an
explicit statement that the quarantine list is currently empty and triage is complete.
Run `quarantine-report.sh` and compare its output to the README's framing.

**Test Cases**:

1. **README implies triage work** (fails on unfixed README): Verify that the unfixed
   README contains no sentence stating "the quarantine list is currently empty" or
   equivalent — confirming the misleading framing exists.
2. **README vs. CI output mismatch** (fails on unfixed README): Run
   `mobile/scripts/quarantine-report.sh` and verify it prints "✅ No quarantined mobile
   E2E tests." while the README provides no reconciling statement.
3. **No triage log exists** (fails on unfixed README): Verify that the unfixed README
   contains no audit record for any of the six active flows.

**Expected Counterexamples**:

- The unfixed README contains no "Current Status" section or equivalent.
- The unfixed README contains no triage log for the six active flows.
- A search for the word "empty" or "no quarantined" in the README returns no results.

---

### Fix Checking

**Goal**: Verify that after the fix, the README accurately communicates the current
empty-quarantine state and triage outcome.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  readme_content := read(mobile/quarantine/README.md)
  ASSERT readme_content CONTAINS "quarantine list is currently empty" (or equivalent)
  ASSERT readme_content CONTAINS triage_record FOR EACH flow IN [smoke, onboarding,
         wallet_creation, contribute, create_group, join_group]
  ASSERT readme_content CONTAINS verdict FOR EACH flow
END FOR
```

**Verification checklist for the fixed README**:

- [ ] README states the quarantine list is empty and all flows are active.
- [ ] README contains a triage log with an entry for each of the six flows.
- [ ] Each triage entry records: flow name, coverage description, verdict, notes.
- [ ] README still contains the "Quarantine a Test" instructions (preservation).
- [ ] README still contains the "Policy" section (preservation).

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the scripts
and flow files behave identically before and after the fix.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT run-tests.sh_original(input) = run-tests.sh_fixed(input)
  ASSERT quarantine-report.sh_original(input) = quarantine-report.sh_fixed(input)
END FOR
```

**Testing Approach**: Script smoke tests and a diff check on unchanged files.

**Test Cases**:

1. **run-tests.sh with empty quarantine list** (Requirement 3.1, 3.4): Run
   `run-tests.sh` with the empty `quarantined_tests.txt` (after the fix) and verify it
   reports "Quarantined: 0 test(s)" and includes all six flow files in the run.
2. **quarantine-report.sh with empty list** (Requirement 3.3): Verify it exits 0 and
   prints "✅ No quarantined mobile E2E tests." — same as before the fix.
3. **echo pattern still documented** (Requirement 3.2): Verify the fixed README still
   contains the `echo ".maestro/flaky_flow.yaml" >>` example.
4. **config.yaml unchanged** (Requirement 3.5): Verify `mobile/.maestro/config.yaml` is
   byte-for-byte identical before and after the fix.
5. **Flow YAMLs unchanged** (Requirement 3.4): Verify that the six flow files are
   byte-for-byte identical before and after the fix (no deletions were required by the
   triage audit).

---

### Unit Tests

- Manually inspect each of the six flow YAML files and verify they reference UI element
  IDs and text that correspond to features present in the application source
  (`mobile/src/`).
- Verify `run-tests.sh` parses the `quarantined_tests.txt` comment-only file without
  error and produces `Quarantined: 0 test(s)`.
- Verify `quarantine-report.sh` reads the comment-only file without error and exits 0.

### Property-Based Tests

Property-based tests are not applicable to this fix because the "function under test" is
a documentation file, not an executable function with a parameterizable input domain.
The closest analogue — the scripts — are already deterministic single-path functions
whose behavior is fully captured by the smoke tests above.

### Integration Tests

- Run `mobile/scripts/quarantine-report.sh` end-to-end against the repository and
  confirm the exit code is 0 and the output matches "✅ No quarantined mobile E2E tests."
- Confirm that the CI workflow (`mobile-e2e.yml`) references `run-tests.sh` and will
  execute all six flows with no skips given the empty quarantine list.
