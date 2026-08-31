# Wave-Ready Issues Directory 🌊

This directory lists all currently active and open **Wave-Ready Issues** for the Stellar-Save project. These issues are funded through the **Drips Wave** program. Contributors who successfully complete them will earn points that convert into USDC funding at the end of the Wave cycle.

For instructions on claiming issues and opening Pull Requests, please read the **[Wave Contributor Guide](wave-guide.md)**.

---

## 📋 Open Issues Catalog

Below is the catalog of the 12 funded issues split across complexity tiers.

### 🟢 Trivial Tier (100 Points Each)

#### 1. `get-current-timestamp` Unit Testing
* **Complexity:** Trivial (100 Points)
* **Status:** Open 🔓
* **Description:** Add unit tests to verify the behavior of the newly implemented `get_current_timestamp` contract method in `contracts/stellar-save/src/lib.rs`.
* **Tasks:**
  - Test basic invocation: set the ledger timestamp to a known value $T$ and verify the return value is exactly $T$.
  - Test idempotence: verify calling the function twice in the same ledger state returns identical values.
  - Test non-zero return: verify that positive timestamps are correctly handled.
  - Test paused state: verify the function still returns correct ledger time even if the contract is paused.

#### 2. `get-current-timestamp` Property Testing
* **Complexity:** Trivial (100 Points)
* **Status:** Open 🔓
* **Description:** Write a property-based test using `proptest` to verify that `get_current_timestamp` operates correctly across the entire valid integer range of ledger timestamps.
* **Tasks:**
  - Use the `proptest!` macro in `lib.rs` with `soroban_sdk::Env::default()`.
  - Assert that for any generated timestamp `t` in `1..=u64::MAX`, setting the ledger timestamp to `t` and querying the helper yields exactly `t`.
  - Label the test with: `// Feature: get-current-timestamp, Property 1: Timestamp round-trip`.

#### 3. Group Analytics Route Registration & AuthGuard
* **Complexity:** Trivial (100 Points)
* **Status:** Open 🔓
* **Description:** Implement route registration and group creator access control for the new frontend Group Analytics page.
* **Tasks:**
  - Add route constant `GROUP_ANALYTICS: "/groups/:groupId/analytics"` to `frontend/src/routing/constants.ts`.
  - Register `/groups/:groupId/analytics` as a protected route.
  - Create the `AuthGuard.tsx` component to redirect non-creator wallets trying to access group analytics back to the group detail page.
  - Add a visible link to the Analytics page on the Group Detail page that is visible *only* to the group creator.

---

### 🟡 Medium Tier (150 Points Each)

#### 4. `validate-max-members` Range Checks
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Refactor the contract's group configuration logic to delegate `max_members` validation to a dedicated contract helper, improving code sharing and layout consistency.
* **Tasks:**
  - Refactor `create_group` and `update_group` in `lib.rs` to replace the inline `max_members` bounds check with a call to `Self::validate_max_members(&env, max_members)?`.
  - Write standard unit tests covering boundary values (exactly at minimum config, exactly at maximum, inside range, out-of-range, and behavior when no config is stored).

#### 5. `validate-max-members` Property-Based Tests
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Implement formal property-based tests for the `validate_max_members` helper to guarantee correctness under generated configs.
* **Tasks:**
  - Write `proptest!` property tests for:
    - **Property 1**: Values below the configured minimum are always rejected with `StellarSaveError::InvalidState`.
    - **Property 2**: Values above the configured maximum are always rejected with `StellarSaveError::InvalidState`.
    - **Property 3**: All values in the inclusive range `[min_members, max_members]` are accepted.
    - **Property 4**: Validator is deterministic (identical inputs always yield identical results).

#### 6. `calculate-current-cycle` Property-Based Tests
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Create `proptest` property-based tests to exhaustively verify the correctness of the elapsed cycle calculator function.
* **Tasks:**
  - Add property tests in `contracts/stellar-save/src/helpers.rs` for:
    - **Property 1**: Querying a non-existent group ID always returns `Err(GroupNotFound)`.
    - **Property 2**: An unstarted group always returns cycle `0`.
    - **Property 3**: The cycle count formula holds true for arbitrary valid started times and elapsed cycles: $C = \min(\lfloor(T_{\text{curr}} - T_{\text{start}}) / D\rfloor, N_{\text{max}} - 1)$.
    - **Property 4**: The returned cycle index is always bounded between `0` and `max_members - 1`.

#### 7. Multi-Token Structs & Key Layout Setup
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Modify error variants and storage layouts to support multi-token assets on Stellar.
* **Tasks:**
  - Implement `TokenConfig` struct and related storage builder keys (`group_token_config(group_id)`, `allowed_tokens()`).
  - Add new error variants `InvalidToken = 5001` and `TokenTransferFailed = 5002` to `StellarSaveError` in `error.rs` along with error category mapping.
  - Implement serialization round-trip property-based tests.

#### 8. Multi-Token Configuration & Helper Validation
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Implement token configuration queries and validation of SEP-41 compliant addresses.
* **Tasks:**
  - Implement `validate_token` helper to retrieve token decimals using `TokenClient` and ensure decimals $\le 38$.
  - Implement the `get_token_config(env, group_id)` public query API.
  - Write comprehensive unit tests verifying that valid token addresses return decimals and invalid/non-token contract addresses are safely rejected.

#### 9. Multi-Token Allowlist Management APIs
* **Complexity:** Medium (150 Points)
* **Status:** Open 🔓
* **Description:** Implement admin interfaces to enforce restricted token support, protecting ROSCA participants from unverified tokens.
* **Tasks:**
  - Add `add_allowed_token`, `remove_allowed_token`, and `is_token_allowed` contract methods.
  - Require contract admin signature verification.
  - Write property tests confirming only the admin can modify the allowlist, and that group creation rejects non-allowlisted tokens when allowlist mode is enabled.

---

### 🔴 High Tier (200 Points Each)

#### 10. `comprehensive-input-validation` Property Tests
* **Complexity:** High (200 Points)
* **Status:** Open 🔓
* **Description:** Write exhaustive property-based tests using `proptest` to cover all input validation edge cases, numerical boundaries, and state transition guards across public contract functions.
* **Tasks:**
  - Write property tests verifying contribution amount exactness (rejecting $a-1$ and $a+1$).
  - Write property tests verifying overflow safety: any `contribution_amount * max_members` product exceeding `i128::MAX` must fail cleanly with `InternalError` during group calculations rather than panicking.

#### 11. Group Analytics Front-End Integration
* **Complexity:** High (200 Points)
* **Status:** Open 🔓
* **Description:** Develop the React custom hooks and visual components for the creator-only Group Analytics page.
* **Tasks:**
  - Implement the custom React hook `useGroupAnalytics` to compose group data and cycle contribution lists, calculating payment rates and projected completions.
  - Design and implement the visual Recharts components (`CycleContributionChart`, `OnTimePaymentCard`, `ProjectedCompletionCard`) using MUI Cards, with skeleton states and full loading indicators.

#### 12. Multi-Token Transfer Integrations & Test Suite
* **Complexity:** High (200 Points)
* **Status:** Open 🔓
* **Description:** Wire up the SEP-41 `transfer_from` and `transfer` calls inside contract entry points, and build a full integration test suite verifying multi-token isolated transactions.
* **Tasks:**
  - Integrate token transfers inside `contribute` and `execute_payout`.
  - Create the multi-token integration test suite in `tests/multi_token.rs`.
  - Write integration tests verifying USDC (7 decimals) and EURC (7 decimals) transactions, native XLM compatibility, reentrancy guards, and complete group isolation (transactions in Group A do not affect Group B's assets).

---

## 🛠️ Claiming an Issue

If you find an issue in the catalog you'd like to work on, head over to the [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues) tab, locate the issue number, and drop a comment so a maintainer can assign it to you. Happy coding! 🌊
