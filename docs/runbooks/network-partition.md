# Runbook: Network Partition

**Scenario:** The backend cannot reach the Stellar RPC endpoint or Horizon API, causing transaction submission failures.  
**Severity:** Warning → Critical (escalates after 15 min)  
**Impact:** Contributions and payouts cannot be submitted; read-only queries may still work via Horizon.

## Detection

- Frontend shows "Transaction failed" or "Network error"
- Backend logs: `ECONNREFUSED`, `ETIMEDOUT`, or `fetch failed` against RPC URL
- `ServiceDown` alert firing (if backend itself is unreachable)

## Immediate Steps

### 1. Confirm the partition

```bash
# Test RPC connectivity
curl -sf "$STELLAR_RPC_URL/health" || echo "RPC unreachable"

# Test Horizon (read-only fallback)
curl -sf "https://horizon-testnet.stellar.org/" | jq .horizon_version

# Test general internet
curl -sf https://1.1.1.1 || echo "No internet"
```

### 2. Switch to backup RPC endpoint

Update the environment and restart the backend:

```bash
# Testnet alternatives
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org          # SDF
# or
export STELLAR_RPC_URL=https://rpc-futurenet.stellar.org            # Futurenet fallback

# Mainnet alternatives
export STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm   # Gateway
# or
export STELLAR_RPC_URL=https://mainnet.stellar.validationcloud.io/v1/$API_KEY

docker restart stellar-save-backend
```

### 3. Verify recovery

```bash
curl http://localhost:3001/api/v2/health | jq .stellar_rpc_status
bash scripts/smoke_test_post_deploy.sh
```

### 4. If partition persists > 15 minutes — queue transactions

The backend's `RecoveryService` can queue failed operations for replay once connectivity is restored. Notify users via status page that submissions are delayed but no data is lost.

### 5. Monitor Stellar network status

- https://status.stellar.org
- https://dashboard.stellar.org

## Escalation

- Partition > 1 hour → notify all active group members of delay.
- Mainnet partition with pending payouts → escalate to on-call; consider manual payout coordination.

## Post-Incident

- Add the backup RPC URL to `environments.toml` as a fallback.
- Consider implementing automatic RPC failover in the backend.
- File incident report within 24 hours (see `docs/incident-response-plan.md`).
