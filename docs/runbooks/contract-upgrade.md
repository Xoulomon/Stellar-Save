# Runbook: Stellar-Save Contract Upgrade & Migration Procedure

This runbook outlines the operational steps, verification procedures, safety protocols, and rollback strategies for executing smart contract upgrades on the `stellar-save` contract deployed to the Stellar network (Soroban).

---

## 1. Overview & Architecture

The `stellar-save` smart contract utilizes Soroban WASM contract code updates alongside schema versioning (`SchemaVersion`). 
Key upgrade principles:
- **State Preservation**: Existing storage entries (Group data, Member profiles, Contribution records, Config) must be preserved across upgrades.
- **Schema Idempotency**: Migration functions check the current `SchemaVersion` and operate as safe no-ops if the contract is already at the target version.
- **Rollback Safety**: Every upgrade must support a reversible round-trip path back to the previous version without corrupting state.

---

## 2. Pre-Upgrade Checklist

Before deploying any WASM bytecode update or triggering schema migration:

- [ ] **WASM Verification**: Build release WASM using reproducible build flags and verify SHA-256 digest against `stellar_save.wasm.sha256`.
- [ ] **Automated Test Suite**: Ensure all 42+ upgrade tests in `contracts/stellar-save/UPGRADE_TESTING.md` pass locally and in CI.
- [ ] **State Snapshot**: Record the state hash or export key storage entries from Testnet/Mainnet state before execution.
- [ ] **Admin Authentication**: Confirm the deploying keys have valid Admin privileges on the target contract instance.
- [ ] **Schema Compatibility**: Ensure new enum discriminants or data field additions are backward compatible with pre-upgrade client calls.

---

## 3. Execution Procedure

### Step 3.1: Upload & Upgrade WASM Code
1. Upload the newly built WASM hash to the network:
   ```bash
   soroban contract install --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm --source admin_key
   ```
2. Upgrade the installed contract code hash:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin_key -- upgrade --new_wasm_hash <NEW_WASM_HASH>
   ```

### Step 3.2: Execute Data Migration (if required)
If the upgrade includes a schema version bump (e.g. `v1 -> v2`):
1. Invoke the migration handler:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin_key -- migrate_schema --target_version 2
   ```
2. Verify schema version state:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> -- get_schema_version
   ```

---

## 4. Post-Upgrade Verification Checklist

- [ ] **Schema Version Verification**: Confirm `get_schema_version()` returns the expected version number.
- [ ] **API Smoke Test**: Execute read-only view calls (`get_group`, `get_member_count`, `get_group_balance`).
- [ ] **Storage Integrity Check**: Confirm pre-existing groups, members, and contribution records remain accessible and uncorrupted.
- [ ] **Transaction Validation**: Perform a test deposit or contribution to verify state updates function post-upgrade.

---

## 5. Rollback Procedure

If critical issues or state errors are detected post-upgrade:

1. **Schema Rollback (if applicable)**:
   Invoke the rollback schema handler to return `SchemaVersion` and state structures to their previous version:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin_key -- rollback_schema --target_version 1
   ```

2. **Revert WASM Bytecode**:
   Re-apply the prior WASM code hash using the upgrade function:
   ```bash
   soroban contract invoke --id <CONTRACT_ID> --source admin_key -- upgrade --new_wasm_hash <PREVIOUS_WASM_HASH>
   ```

3. **Post-Rollback Verification**:
   Verify `get_schema_version()` returns `1` and validate state round-trip integrity.
