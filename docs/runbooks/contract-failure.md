# Runbook: Contract Failure

**Scenario:** Soroban smart contract is unresponsive, panicking, or producing incorrect results.  
**Severity:** Critical  
**Impact:** All group contributions and payouts halted.

## Detection

- Smoke tests fail post-deploy (`scripts/smoke_test_post_deploy.sh`)
- On-chain invocations return `HostError` or unexpected results
- Frontend shows persistent transaction errors

## Immediate Steps

### 1. Pause affected groups (if contract is still callable)

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$STELLAR_NETWORK" \
  --source-account "$ADMIN_SECRET" \
  -- pause_group --group_id <id> --caller "$ADMIN_ADDRESS"
```

Repeat for each active group. This halts contributions and payouts without data loss.

### 2. Identify the failure

```bash
# Check recent contract events
stellar events \
  --network "$STELLAR_NETWORK" \
  --contract-id "$CONTRACT_ID" \
  --start-ledger $(( $(stellar ledger current --network "$STELLAR_NETWORK") - 1000 ))

# Reproduce locally
cargo test --manifest-path contracts/stellar-save/Cargo.toml -- --nocapture 2>&1 | tail -50
```

### 3. Rollback to last known-good WASM

```bash
ROLLBACK_ARTIFACT_RUN_ID=<run-id> \
STELLAR_NETWORK=mainnet \
STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm \
DEPLOYER_SECRET="$DEPLOYER_SECRET" \
GH_TOKEN="$GH_TOKEN" \
REPO=Xoulomon/Stellar-Save \
bash scripts/rollback.sh
```

Or use the automated recovery script:

```bash
bash scripts/dr_recover.sh contract-rollback --run-id <run-id>
```

### 4. Unpause groups after successful rollback

```bash
stellar contract invoke \
  --id "$NEW_CONTRACT_ID" \
  --network "$STELLAR_NETWORK" \
  --source-account "$ADMIN_SECRET" \
  -- unpause_group --group_id <id> --caller "$ADMIN_ADDRESS"
```

### 5. Verify

```bash
bash scripts/smoke_test_post_deploy.sh
bash scripts/verify_contract.sh
```

## Escalation

- Rollback fails → escalate to Stellar core team; do not attempt further deploys.
- Data inconsistency suspected → halt all operations and escalate immediately.

## Post-Incident

- Root-cause the bug and add a regression test.
- Update `contracts/stellar-save/OPTIMIZATION_SUMMARY.md` with the incident.
- File incident report within 24 hours (see `docs/incident-response-plan.md`).
