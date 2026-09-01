

## [Smart Contracts] #76 Add negative-path tests for `guess-the-number` invalid guesses

**Description:**
`contracts/guess-the-number` test suite likely covers happy path only; add tests for out-of-range and repeated guesses.

**Tasks:**
- Add tests for out-of-bounds guess values
- Add tests for post-game-end guess attempts
- Verify correct error returned in each case

**Acceptance Criteria:**
- [ ] Negative-path tests added
- [ ] All assert correct error type
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 1-2 hours
---

## [Smart Contracts] #77 Refactor `fungible-allowlist` to isolate token logic from allowlist policy

**Description:**
Allowlist policy checks and SEP-41 token mechanics are interleaved in `contracts/fungible-allowlist/src`, hurting reuse of the base token logic.

**Tasks:**
- Extract allowlist policy into a `policy.rs` module
- Keep token transfer/mint logic separate and unaware of policy internals
- Wire policy checks via a trait or hook function

**Acceptance Criteria:**
- [ ] Policy and token logic decoupled
- [ ] Related to: #66
- [ ] Tested (unit)

**Type**: Refactor
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Smart Contracts] #78 Add cross-contract integration test harness

**Description:**
No shared harness exists for testing interactions between `stellar-save` and token/allowlist contracts together.

**Tasks:**
- Build a shared test harness spinning up multiple contracts in one env
- Add scenario: save contract interacting with allowlisted token
- Document harness usage for future cross-contract tests

**Acceptance Criteria:**
- [ ] Harness added and documented
- [ ] Blocked by: #55
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Smart Contracts] #79 Remove duplicate constant definitions across contracts

**Description:**
Constants like max basis points, decimals, or scaling factors are redefined per contract instead of a shared constants module.

**Tasks:**
- Consolidate into shared `contracts/common/constants.rs` (uses #61)
- Replace duplicated literals across contracts
- Verify no numeric drift introduced

**Acceptance Criteria:**
- [ ] Blocked by: #61
- [ ] No duplicate constants remain
- [ ] Tested (unit)

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 1-2 hours
---

## [Smart Contracts] #80 Formalize contract test coverage reporting with `cargo-tarpaulin` or `llvm-cov`

**Description:**
No coverage tooling is currently wired for `contracts/*`, making the 90%+ target unverifiable.

**Tasks:**
- Add `cargo llvm-cov` config for contract workspace
- Generate baseline coverage report per contract
- Document target (90%+) and how to run locally

**Acceptance Criteria:**
- [ ] Coverage tool configured
- [ ] Baseline report committed
- [ ] Tested (unit, coverage measured)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 3-5 hours
---

## [Testing] #81 Establish backend unit test coverage baseline at 85%+

**Description:**
`backend/test/unit` coverage is unmeasured/inconsistent; establish a baseline and enforced minimum.

**Tasks:**
- Configure Jest coverage thresholds at 85% for `backend/src`
- Identify and close largest coverage gaps first
- Document how to run coverage locally

**Acceptance Criteria:**
- [ ] Coverage threshold enforced at 85%+
- [ ] Tested (unit)
- [ ] Code review passed

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 3+ days
---

## [Testing] #82 Add integration tests for auth service (post-refactor)

**Description:**
Following auth handler refactor (#36), add integration tests covering login, refresh, and revocation flows end-to-end against a test DB.

**Tasks:**
- Add tests in `backend/test/integration` for full auth lifecycle
- Use `backend/test/fixtures` for seeded users
- Cover invalid-credential and expired-token cases

**Acceptance Criteria:**
- [ ] Blocked by: #36
- [ ] Full auth lifecycle covered
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Testing] #83 Add E2E test for wallet connect → deposit → withdraw flow

**Description:**
`frontend/e2e` lacks a full happy-path savings flow test covering wallet connection through withdrawal confirmation.

**Tasks:**
- Add Playwright/Cypress spec in `frontend/e2e`
- Use `frontend/e2e/helpers` for wallet mocking
- Assert on-chain state and UI state converge

**Acceptance Criteria:**
- [ ] E2E spec added and passing
- [ ] Related to: #91
- [ ] Tested (E2E)

**Type**: Testing
**Priority**: P0-Critical
**Estimated Effort**: 1-2 days
---

## [Testing] #84 Remove flaky synthetic monitoring tests in `frontend/e2e/synthetic`

**Description:**
Synthetic E2E tests intermittently fail due to timing assumptions, reducing signal from the suite.

**Tasks:**
- Identify tests with >5% flake rate over last runs
- Replace fixed waits with proper wait-for-condition assertions
- Remove tests that duplicate coverage already in `frontend/e2e`

**Acceptance Criteria:**
- [ ] Flake rate reduced to <1%
- [ ] Duplicate tests removed
- [ ] Tested (E2E)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Testing] #85 Add unit tests for WalletService achieving 90%+ coverage

**Description:**
Wallet connection/signing logic (post #22 extraction) needs dedicated, thorough unit coverage using mocked Stellar SDK.

**Tasks:**
- Blocked by: #22
- Test transaction signing, validation, and error cases
- Use Jest with `@stellar/stellar-sdk` mocks from `frontend/src/__mocks__`

**Acceptance Criteria:**
- [ ] 90%+ coverage on WalletService
- [ ] Blocked by: #22
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P0-Critical
**Estimated Effort**: 1-2 days
---

## [Testing] #86 Add contract-level integration tests for upgrade path

**Description:**
No automated test currently exercises the contract upgrade mechanism end-to-end (deploy old → upgrade → verify state).

**Tasks:**
- Add integration test deploying v1, upgrading to v2, asserting state preserved
- Cover rejected downgrade attempt (uses #72)
- Document in upgrade runbook (#4)

**Acceptance Criteria:**
- [ ] Blocked by: #72
- [ ] Upgrade and rejection paths tested
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P0-Critical
**Estimated Effort**: 1-2 days
---

## [Testing] #87 Add mock service worker (MSW) setup for frontend API tests

**Description:**
Frontend component tests likely hit real fetch/GraphQL calls or use ad-hoc mocks instead of a consistent MSW setup.

**Tasks:**
- Configure MSW handlers in `frontend/src/__mocks__`
- Migrate existing component tests to use MSW
- Document handler-adding convention

**Acceptance Criteria:**
- [ ] MSW configured and adopted
- [ ] Convention documented
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Testing] #88 Add load test scenario for concurrent deposit requests

**Description:**
`backend/tests/load` should include a scenario simulating concurrent deposits to catch race conditions in balance updates.

**Tasks:**
- Add k6/artillery script for concurrent deposit load
- Assert final balances match expected totals (no lost updates)
- Document how to run against staging

**Acceptance Criteria:**
- [ ] Load scenario added
- [ ] No balance drift detected under load
- [ ] Tested (load)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Testing] #89 Deduplicate overlapping unit and integration tests in `backend/test`

**Description:**
Some scenarios appear tested at both unit and integration level redundantly, slowing CI-independent local runs.

**Tasks:**
- Audit `backend/test/unit` vs `backend/test/integration` for overlap
- Remove redundant lower-value duplicates (prefer unit for logic, integration for wiring)
- Document the unit vs integration boundary

**Acceptance Criteria:**
- [ ] Redundant tests removed
- [ ] Boundary documented
- [ ] Tested (unit + integration)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #90 Add snapshot tests for GraphQL schema to prevent breaking changes

**Description:**
No test currently fails CI-equivalent local checks when `backend/src/graphql` schema changes break existing consumers.

**Tasks:**
- Add schema snapshot test using `graphql-inspector` or similar
- Fail on breaking change without explicit approval
- Document override process for intentional breaking changes

**Acceptance Criteria:**
- [ ] Schema snapshot test added
- [ ] Breaking change detection verified
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 3-5 hours
---

## [Testing] #91 Add fixtures for multi-user group savings scenarios

**Description:**
`backend/test/fixtures` likely lacks realistic multi-user group data needed to test group savings edge cases.

**Tasks:**
- Add fixture factory for groups with N members and mixed contribution states
- Use in relevant integration tests
- Document fixture factory usage

**Acceptance Criteria:**
- [ ] Fixture factory added
- [ ] Related to: #83
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #92 Add canary smoke-gate coverage for withdrawal failover (follow-up)

**Description:**
Following recent canary smoke-gate and failover test additions, extend coverage to withdrawal-specific failover scenarios not yet covered.

**Tasks:**
- Review existing canary/failover tests from recent commit
- Add withdrawal-path failover scenario
- Verify dedup wallet test coverage extends to withdrawals

**Acceptance Criteria:**
- [ ] Withdrawal failover scenario added
- [ ] Tested (integration)
- [ ] Code review passed

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 3-5 hours
---

## [Testing] #93 Add unit tests for i18n locale completeness

**Description:**
`frontend/src/locales` may have missing keys per locale that aren't caught until runtime.

**Tasks:**
- Add a test asserting all locale files have matching key sets
- Fail on missing/extra keys per locale
- Fix any gaps discovered

**Acceptance Criteria:**
- [ ] Locale completeness test added
- [ ] All locales pass
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P3-Low
**Estimated Effort**: 1-2 hours
---

## [Testing] #94 Add regression test suite for GroupCard/SearchBar fixes

**Description:**
Recent fixes (PRs #1451, #1450) should be locked in with explicit regression tests to prevent reintroduction.

**Tasks:**
- Add regression test for GroupCard subcomponent prop contract
- Add regression test for SearchBar shared-filtering bug scenario
- Related to: #16, #17

**Acceptance Criteria:**
- [ ] Regression tests added for both fixes
- [ ] Related to: #16, #17
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 3-5 hours
---

## [Testing] #95 Add performance regression gate for contract instruction counts (follow-up)

**Description:**
Following the recent perf regression gate commit, extend it to cover `nft-enumerable` and `fungible-allowlist` contracts, not just `stellar-save`.

**Tasks:**
- Extend perf gate script to run against all contracts
- Set baseline thresholds per contract
- Document how to update baselines intentionally

**Acceptance Criteria:**
- [ ] Gate covers all 4 contracts
- [ ] Baselines documented
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #96 Add contract test coverage for `stellar-save` interest/yield calculation edge cases

**Description:**
Interest/yield calculations need tests for zero-balance, single-day, and leap-year time period edge cases.

**Tasks:**
- Add tests for zero balance and minimal time deltas
- Add tests spanning leap years/month boundaries
- Assert rounding behavior is deterministic

**Acceptance Criteria:**
- [ ] Edge case tests added
- [ ] Rounding behavior documented and tested
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P0-Critical
**Estimated Effort**: 1-2 days
---

## [Testing] #97 Add E2E accessibility test suite using axe-playwright

**Description:**
No automated a11y check runs against real rendered pages in `frontend/e2e`, relying only on unit-level `jest-axe` (#11).

**Tasks:**
- Add `axe-playwright` checks to key E2E flows
- Fail build on critical/serious violations
- Related to: #11

**Acceptance Criteria:**
- [ ] a11y checks added to E2E suite
- [ ] Related to: #11
- [ ] Tested (E2E)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #98 Remove redundant duplicate wallet tests (follow-up to dedup commit)

**Description:**
Following the recent dedup wallet tests commit, audit remaining wallet-related test files for any leftover duplication across unit/integration/E2E layers.

**Tasks:**
- Cross-reference wallet tests across `frontend`, `backend`, and `contracts`
- Remove any remaining duplicate assertions
- Document canonical location per test type

**Acceptance Criteria:**
- [ ] No duplicate wallet test coverage remains
- [ ] Canonical locations documented
- [ ] Tested (unit + integration)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #99 Add integration tests for IPFS upload/retrieval service

**Description:**
`backend/src/ipfs` lacks integration tests against a local IPFS test node or mock, risking silent regressions.

**Tasks:**
- Stand up local IPFS test double or use `backend/test/helpers`
- Test upload, retrieval, and failure/retry (#44) paths
- Related to: #44

**Acceptance Criteria:**
- [ ] Integration tests added
- [ ] Related to: #44
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Testing] #100 Add mutation testing for critical contract arithmetic (stryker/mutants)

**Description:**
Line/branch coverage alone doesn't verify test assertion quality for balance arithmetic; add mutation testing to `contracts/stellar-save`.

**Tasks:**
- Configure `cargo-mutants` for `contracts/stellar-save`
- Run against arithmetic-heavy modules
- Fix any surviving mutants by strengthening tests

**Acceptance Criteria:**
- [ ] Mutation testing configured
- [ ] Mutant survival rate reported and reduced
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Testing] #101 Add visual regression testing for core UI components

**Description:**
No visual regression tooling exists to catch unintended CSS/layout drift in `frontend/src/components`.

**Tasks:**
- Add Playwright screenshot-based visual tests for key components
- Establish baseline screenshots
- Document approval process for intentional visual changes

**Acceptance Criteria:**
- [ ] Visual regression suite added
- [ ] Baselines committed
- [ ] Tested (E2E)

**Type**: Testing
**Priority**: P3-Low
**Estimated Effort**: 1-2 days
---

## [Testing] #102 Add analytics event contract tests

**Description:**
The `analytics` directory likely lacks tests verifying tracked events match an agreed schema, risking silent analytics drift.

**Tasks:**
- Define an event schema (name + required properties) in `analytics`
- Add tests asserting emitted events conform to schema
- Fail on unexpected/undocumented events

**Acceptance Criteria:**
- [ ] Event schema defined
- [ ] Contract tests added
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P3-Low
**Estimated Effort**: 3-5 hours
---

## [Testing] #103 Add database migration rollback tests

**Description:**
`database/migrations` migrations are not verified to roll back cleanly, risking failed rollback during incidents.

**Tasks:**
- Add automated test applying then rolling back each migration
- Fix any migration missing a valid `down` step
- Document in migration conventions guide (#5)

**Acceptance Criteria:**
- [ ] All migrations roll back cleanly
- [ ] Related to: #5
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Testing] #104 Add unit tests for shared validation lib (post #7)

**Description:**
After consolidating validation logic (#7), the new shared module needs dedicated 90%+ coverage including boundary/malformed inputs.

**Tasks:**
- Blocked by: #7
- Add boundary and malformed-input test cases
- Ensure 90%+ coverage on the module

**Acceptance Criteria:**
- [ ] Blocked by: #7
- [ ] 90%+ coverage achieved
- [ ] Tested (unit)

**Type**: Testing
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Testing] #105 Add chaos test for RPC node failover in staging

**Description:**
No test currently validates backend behavior when the primary Soroban RPC node becomes unavailable mid-transaction.

**Tasks:**
- Simulate RPC outage against staging endpoint
- Verify circuit breaker (#57) and failover behavior trigger correctly
- Document expected recovery time

**Acceptance Criteria:**
- [ ] Blocked by: #57
- [ ] Failover behavior verified
- [ ] Tested (integration)

**Type**: Testing
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Code Quality] #106 Enforce ESLint `no-unused-vars` and `no-explicit-any` across frontend

**Description:**
`frontend` ESLint config likely doesn't enforce these rules strictly, allowing unused vars and untyped `any` to accumulate.

**Tasks:**
- Enable `no-unused-vars` and `@typescript-eslint/no-explicit-any` in `frontend/.eslintrc`
- Fix all existing violations
- Add pre-commit hook to catch new violations

**Acceptance Criteria:**
- [ ] Rules enabled and enforced
- [ ] Existing violations fixed
- [ ] Tested (lint passes clean)

**Type**: Cleanup
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Code Quality] #107 Enforce ESLint rules across backend TypeScript

**Description:**
`backend/src` likely has a looser or missing ESLint config compared to frontend, causing inconsistent code style.

**Tasks:**
- Align `backend` ESLint config with `frontend` shared rules
- Fix all violations across `backend/src`
- Add lint script to `package.json`

**Acceptance Criteria:**
- [ ] Config aligned
- [ ] Violations fixed
- [ ] Tested (lint passes clean)

**Type**: Cleanup
**Priority**: P1-High
**Estimated Effort**: 1-2 days
---

## [Code Quality] #108 Adopt Prettier with shared config across frontend and backend

**Description:**
Inconsistent formatting suggests no shared Prettier config is enforced across `frontend` and `backend`.

**Tasks:**
- Add root-level `.prettierrc` shared by both packages
- Run `prettier --write` across `frontend/src` and `backend/src`
- Add pre-commit formatting hook

**Acceptance Criteria:**
- [ ] Shared config added
- [ ] Codebase formatted consistently
- [ ] Tested (format check passes)

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #109 Enforce `rustfmt` and `clippy` gates for contract crates

**Description:**
`contracts/*` crates may not have `rustfmt.toml` conventions or a documented clippy baseline (related to #69).

**Tasks:**
- Add root `rustfmt.toml` with team conventions
- Run `cargo fmt --all` across `contracts`
- Related to: #69

**Acceptance Criteria:**
- [ ] `rustfmt.toml` added
- [ ] Codebase formatted
- [ ] Related to: #69

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #110 Remove unused Rust dependencies from contract Cargo.toml files

**Description:**
Contract crates may retain unused dependencies increasing compile time and binary size unnecessarily.

**Tasks:**
- Run `cargo udeps` (or manual audit) per contract crate
- Remove unused dependencies
- Verify contracts still build and pass tests

**Acceptance Criteria:**
- [ ] Unused deps removed
- [ ] Build and tests pass
- [ ] Tested (unit)

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #111 Add strict TypeScript config (`strict: true`) to frontend

**Description:**
`frontend/tsconfig.json` may not have `strict` mode fully enabled, allowing implicit `any` and unsound null handling.

**Tasks:**
- Enable `strict: true` incrementally (file-by-file allowlist if needed)
- Fix resulting type errors
- Remove allowlist once clean

**Acceptance Criteria:**
- [ ] `strict: true` enabled repo-wide
- [ ] Zero type errors
- [ ] Tested (typecheck passes)

**Type**: Refactor
**Priority**: P1-High
**Estimated Effort**: 3+ days
---

## [Code Quality] #112 Add strict TypeScript config to backend

**Description:**
`backend/tsconfig.json` likely mirrors the frontend's non-strict setup; align both for consistent type safety.

**Tasks:**
- Enable `strict: true` in `backend/tsconfig.json`
- Fix resulting type errors across `backend/src`
- Related to: #111

**Acceptance Criteria:**
- [ ] `strict: true` enabled
- [ ] Zero type errors
- [ ] Tested (typecheck passes)

**Type**: Refactor
**Priority**: P1-High
**Estimated Effort**: 3+ days
---

## [Code Quality] #113 Add dependency vulnerability scanning for npm packages

**Description:**
No documented process runs `npm audit`/`osv-scanner` regularly against `frontend` and `backend` dependencies.

**Tasks:**
- Add `npm audit --production` check as a local script
- Fix or document acceptable-risk high/critical vulnerabilities
- Document the review cadence

**Acceptance Criteria:**
- [ ] Script added and run
- [ ] Critical/high vulns resolved or documented
- [ ] Tested (script runs clean)

**Type**: Cleanup
**Priority**: P1-High
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #114 Add `cargo audit` scanning for contract dependencies

**Description:**
Rust contract crates should be scanned for known-vulnerable dependency versions given they handle user funds.

**Tasks:**
- Run `cargo audit` across `contracts/` workspace
- Update or replace flagged dependencies
- Document exceptions with justification

**Acceptance Criteria:**
- [ ] `cargo audit` clean or exceptions documented
- [ ] Tested (unit, post-update)
- [ ] Code review passed

**Type**: Cleanup
**Priority**: P0-Critical
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #115 Consolidate duplicate utility functions across frontend/backend

**Description:**
Formatting utilities (date, currency, address truncation) are likely duplicated between `frontend/src/lib` and `backend/src/lib`.

**Tasks:**
- Identify shared-shape utilities duplicated across packages
- Extract to a shared package/workspace module if monorepo tooling allows
- Migrate both packages to use it

**Acceptance Criteria:**
- [ ] Duplication removed or documented if unshareable
- [ ] Tested (unit)
- [ ] Code review passed

**Type**: Refactor
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Code Quality] #116 Add commit-scoped pre-commit hook for lint + typecheck

**Description:**
No pre-commit hook currently blocks lint/typecheck violations from being committed, letting issues reach review.

**Tasks:**
- Add `husky` + `lint-staged` config at repo root
- Run ESLint, Prettier check, and `tsc --noEmit` on staged files
- Document bypass policy for emergencies

**Acceptance Criteria:**
- [ ] Hook installed and functional
- [ ] Verified blocking on a violation
- [ ] Documented bypass policy

**Type**: Feature
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #117 Remove unused exports across frontend and backend via `ts-prune`

**Description:**
Dead exported functions/types accumulate over time; a repo-wide sweep with `ts-prune` will surface and remove them.

**Tasks:**
- Run `ts-prune` against `frontend/src` and `backend/src`
- Remove confirmed-unused exports
- Re-export intentionally-public API explicitly to avoid false positives

**Acceptance Criteria:**
- [ ] `ts-prune` output triaged and cleaned
- [ ] Build and tests pass
- [ ] Tested (unit)

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Code Quality] #118 Standardize import ordering with `eslint-plugin-import`

**Description:**
Import statement ordering is inconsistent across the frontend and backend, causing noisy diffs on unrelated changes.

**Tasks:**
- Add `eslint-plugin-import` ordering rule to shared config (#108)
- Auto-fix existing files
- Document grouping convention (external/internal/relative)

**Acceptance Criteria:**
- [ ] Rule enforced
- [ ] Codebase auto-fixed
- [ ] Related to: #108

**Type**: Cleanup
**Priority**: P3-Low
**Estimated Effort**: 1-2 hours
---

## [Code Quality] #119 Remove duplicate Prisma client instantiations

**Description:**
Multiple files in `backend/src` may instantiate `PrismaClient` independently instead of a single shared singleton.

**Tasks:**
- Create single `backend/src/lib/prisma.ts` singleton
- Replace all direct `new PrismaClient()` calls
- Verify connection pool behavior under load (#88)

**Acceptance Criteria:**
- [ ] Single Prisma singleton in use
- [ ] Related to: #88
- [ ] Tested (integration)

**Type**: Cleanup
**Priority**: P1-High
**Estimated Effort**: 1-2 hours
---

## [Code Quality] #120 Add `.editorconfig` and enforce consistent line endings

**Description:**
Mixed line endings/indentation likely exist across the repo given multiple contributor environments (Windows/macOS/Linux).

**Tasks:**
- Add root `.editorconfig` with consistent indent/line-ending rules
- Normalize existing files with `git diff --check`
- Document in contributor guide

**Acceptance Criteria:**
- [ ] `.editorconfig` added
- [ ] Files normalized
- [ ] Tested (diff check clean)

**Type**: Cleanup
**Priority**: P3-Low
**Estimated Effort**: 1-2 hours
---

## [Code Quality] #121 Audit and remove unused GitHub-adjacent config files not tied to CI

**Description:**
Stale config files (old linters, unused formatter configs) may remain from tooling migrations; excludes any CI/CD pipeline files.

**Tasks:**
- Audit root and package-level config files for staleness
- Remove configs superseded by current tooling (e.g., old `.eslintrc` variants)
- Verify no tool silently falls back to a removed config

**Acceptance Criteria:**
- [ ] Stale configs removed
- [ ] Tooling verified still functional
- [ ] Tested (lint/build/test all pass)

**Type**: Cleanup
**Priority**: P3-Low
**Estimated Effort**: 1-2 hours
---

## [Code Quality] #122 Add type-safe GraphQL client codegen for frontend

**Description:**
Frontend GraphQL queries may be hand-typed instead of generated from the backend schema, risking type drift.

**Tasks:**
- Add `graphql-code-generator` config targeting `backend/src/graphql` schema
- Generate typed hooks for existing queries/mutations
- Remove hand-written duplicate types

**Acceptance Criteria:**
- [ ] Codegen configured and run
- [ ] Hand-written duplicate types removed
- [ ] Tested (typecheck + unit)

**Type**: Refactor
**Priority**: P2-Medium
**Estimated Effort**: 1-2 days
---

## [Code Quality] #123 Consolidate duplicate Zod/Yup schemas between frontend and contract-facing types

**Description:**
`frontend/src/schemas` may duplicate shape definitions that also exist implicitly in backend DTOs, risking drift on field changes.

**Tasks:**
- Cross-reference `frontend/src/schemas` against `backend/src/modules` DTOs
- Align field names/types, documenting any intentional differences
- Add a shared type-check test asserting shape compatibility

**Acceptance Criteria:**
- [ ] Schemas cross-checked and aligned
- [ ] Compatibility test added
- [ ] Tested (unit)

**Type**: Cleanup
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---

## [Code Quality] #124 Remove unused demo/design assets from production build path

**Description:**
`demo` and `design` directories at repo root may be accidentally included in build tooling glob patterns, bloating build times.

**Tasks:**
- Verify `demo`/`design` are excluded from `frontend`/`backend` build globs
- Move genuinely unused legacy demo code out of active build paths
- Document purpose of retained files

**Acceptance Criteria:**
- [ ] Build globs confirmed to exclude non-source dirs
- [ ] Purpose documented for retained files
- [ ] Tested (build)

**Type**: Cleanup
**Priority**: P3-Low
**Estimated Effort**: 1-2 hours
---

## [Code Quality] #125 Establish and document a repo-wide semantic versioning + changelog policy

**Description:**
No consistent changelog convention exists across `backend`, `frontend`, and `contracts`, making it hard to track breaking changes (e.g., deprecations from #37, #56).

**Tasks:**
- Adopt `CHANGELOG.md` per package following Keep a Changelog format
- Backfill recent notable changes (deprecations, migrations)
- Related to: #37, #56, #4

**Acceptance Criteria:**
- [ ] Changelog files added per package
- [ ] Related to: #37, #56, #4
- [ ] Code review passed

**Type**: Documentation
**Priority**: P2-Medium
**Estimated Effort**: 3-5 hours
---
