# Runbook: Key Compromise

**Scenario:** A Stellar secret key (deployer, admin, or member) is suspected or confirmed compromised.  
**Severity:** Critical  
**Impact:** Unauthorised contract deploys, group pauses, or fund access.

## Detection

- Unexpected transactions from a known key on Stellar Explorer
- Secret key found in git history, logs, or public leak
- `gitleaks` / `secret-scan` CI job alerts

## Immediate Steps

### 1. Rotate the compromised key immediately

```bash
# Generate a new key
stellar keys generate new-deployer --network "$STELLAR_NETWORK"
NEW_PUBLIC=$(stellar keys address new-deployer)
echo "New public key: $NEW_PUBLIC"
```

Fund the new key (testnet):
```bash
curl "https://friendbot.stellar.org?addr=$NEW_PUBLIC"
```

### 2. Revoke / isolate the old key

On Stellar, keys cannot be "revoked" directly — instead:

```bash
# Merge old account into new (drains XLM and removes old account)
stellar tx new account-merge \
  --source-account old-deployer \
  --destination "$NEW_PUBLIC" \
  --network "$STELLAR_NETWORK" \
  --build-only | stellar tx sign --sign-with old-deployer | stellar tx submit
```

If the old key is an admin signer on a multisig account, remove it:
```bash
stellar tx new set-options \
  --source-account "$ADMIN_ADDRESS" \
  --signer-key <old-public-key> \
  --signer-weight 0 \
  --network "$STELLAR_NETWORK" \
  --build-only | stellar tx sign --sign-with current-admin | stellar tx submit
```

### 3. Rotate all secrets in CI/CD

1. Go to **GitHub → Settings → Secrets and variables → Actions**.
2. Update every secret that referenced the compromised key:
   - `DEPLOYER_SECRET`
   - `ADMIN_SECRET`
   - Any `STELLAR_*_SECRET` variables
3. Re-run the last deployment workflow to confirm the new key works.

### 4. Audit recent transactions

```bash
# Check last 200 operations from the compromised key
stellar operations \
  --source-account <old-public-key> \
  --network "$STELLAR_NETWORK" \
  --limit 200
```

Look for unexpected `invoke_host_function`, `payment`, or `account_merge` operations.

### 5. Pause contract if unauthorised admin actions are suspected

```bash
bash scripts/dr_recover.sh pause-all-groups
```

## Escalation

- Funds moved without authorisation → contact Stellar Development Foundation security team.
- Key found in public repository → rotate immediately, then audit all forks.

## Post-Incident

- Scan git history: `git log --all -p | grep -i secret`.
- Add the leaked key pattern to `.gitleaks.toml`.
- File incident report within 24 hours (see `docs/incident-response-plan.md`).
