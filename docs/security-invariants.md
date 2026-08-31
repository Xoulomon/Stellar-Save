# Security Invariants & Overflow Protection Guarantees

## Arithmetic & Overflow Safety

All mathematical operations within the Stellar-Save smart contract suite are protected against overflow, underflow, and unexpected arithmetic wrap-around.

### Guaranteed Invariants
1. **Pool Calculation**:
   - `total_pool = contribution_amount.checked_mul(member_count as i128)`
   - Guarantees `total_pool` calculation fails gracefully with `StellarSaveError::Overflow` rather than overflowing.

2. **Cycle Counter Advancement**:
   - Cycle advancement uses `checked_add` and `saturating_add`.
   - Prevents cycle overflow past `u32::MAX`.

3. **Contribution Aggregation**:
   - Total group contributions and balance tracking use checked operations (`checked_add`, `checked_sub`).

4. **Timestamp & Deadline Extensions**:
   - Timestamp calculations use `checked_add` to prevent clock wrapping.

## Verification
- Unit tests verify boundary arithmetic inputs (e.g. `i128::MAX`, `u32::MAX`).
