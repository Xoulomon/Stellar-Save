#!/usr/bin/env bash
# scripts/canary_rollback.sh
# Rolls back a canary deployment by setting traffic weight to 0 and
# restoring the stable contract ID as the sole active contract.
# Safe to run multiple times (idempotent).
#
# Required env vars:
#   STELLAR_NETWORK  — testnet | mainnet
#
# Optional:
#   ROLLBACK_REASON  — human-readable reason logged to the registry
set -euo pipefail

: "${STELLAR_NETWORK:?}"

ROLLBACK_REASON="${ROLLBACK_REASON:-manual}"
REGISTRY="$(dirname "$0")/../deployment-records/active.json"

cd "$(dirname "$0")/.."

echo "════════════════════════════════════════"
echo "  CANARY ROLLBACK — ${STELLAR_NETWORK}"
echo "  Reason: ${ROLLBACK_REASON}"
echo "════════════════════════════════════════"

if [ ! -f "$REGISTRY" ]; then
  echo "❌ Registry not found: $REGISTRY" >&2; exit 1
fi

python3 - <<EOF
import json, datetime

with open("$REGISTRY") as f:
    data = json.load(f)

canary_id = data.get("canary_contract_id", "")
stable_id = data.get("stable_contract_id", "")

if not stable_id:
    print("❌ No stable contract ID in registry — cannot rollback")
    exit(1)

data["canary_weight"] = 0
data["status"] = "rolled_back"
data["rolled_back_at"] = datetime.datetime.utcnow().isoformat() + "Z"
data["rollback_reason"] = "$ROLLBACK_REASON"

with open("$REGISTRY", "w") as f:
    json.dump(data, f, indent=2)

print(f"  Stable  : {stable_id}")
print(f"  Canary  : {canary_id} (weight → 0%)")
print(f"  Status  : rolled_back")
EOF

echo
echo "✅ Canary rolled back. All traffic now routes to stable contract."
echo "   Run smoke tests to confirm stable is healthy:"
echo "   CONTRACT_ID=<stable_id> bash scripts/smoke_test_post_deploy.sh"
