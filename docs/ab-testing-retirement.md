# A/B Testing Experiment Retirement Process

## Overview
This document defines the lifecycle and retirement process for A/B testing experiment definitions within Stellar-Save (Issue #1700).

Stale experiment definitions and feature flags introduce cognitive overhead, unnecessary branching, dead code paths, and telemetry pollution. To maintain codebase hygiene and predictable runtime behavior, all concluded experiments must follow this formal retirement workflow.

---

## 2026-09-26 Audit Summary
- **Audited Service**: `backend/src/ab_testing.ts`
- **Findings**: Historical experiments have reached statistical significance or completed rollout decisions in accordance with the product roadmap.
- **Action Taken**:
  - Removed obsolete experiment constants and unused branching logic.
  - Retained deterministic user bucketing infrastructure with constructor dependency injection (`ABTestingDeps`).
  - Active experiment count reset to `0`.

---

## Experiment Retirement Checklist

When an A/B test reaches completion, the owning engineer must complete the following steps:

1. **Verify Decision Record**:
   - Confirm that product management / analytics has finalized the experiment conclusion (winning variant selected or rolled back).
   - Ensure the rollout decision is logged in project tracking.

2. **Remove Experiment Constants**:
   - Locate and delete the `EXP_<NAME>` constant definition in `backend/src/ab_testing.ts`.

3. **Purge Consuming Feature Code**:
   - Search the entire repository for usages of the experiment key:
     ```bash
     grep -rn "EXP_<NAME>" backend/ frontend/
     grep -rn "<experiment-key>" backend/ frontend/
     ```
   - Remove all conditional branches (`isInBucket`, `getBucket`) that test variant assignment. Promote the winning variant's logic to the default code path and delete obsolete variant paths.

4. **Clean Up Telemetry and Analytics**:
   - Remove or archive experiment-specific tracking dimensions in analytics dispatchers to avoid polluting ongoing metrics dashboards.

5. **Update Unit Tests**:
   - Remove variant-specific tests and verify that feature tests pass cleanly on the permanent implementation path.

6. **Pull Request Submission**:
   - Include references to the original experiment issue/RFC.
   - Tag the PR with `chore(ab-testing)` and link this document.
