#!/usr/bin/env bash
# scripts/canary_promote.sh
# Gradually promotes the canary to stable by stepping through traffic weights.
# On each step: update weight → wait → run health check → continue or rollback.
#
# Required env vars:
#   STELLAR_NETWORK  — testnet | mainnet
#   STELLAR_RPC_URL  — RPC endpoint
#
# Optional:
#   PROMOTION_STEPS          — comma-separated weights (default: 10,25,50,100)
#   STEP_INTERVAL_SECONDS    — wait between steps (default: 300)
set -euo pipefail

: "${STELLAR_NETWORK:?}"
: "${STELLAR_RPC_URL:?}"

IFS=',' read -ra STEPS <<< "${PROMOTION_STEPS:-10,25,50,100}"
STEP_INTERVAL="${STEP_INTERVAL_SECONDS:-300}"
REGISTRY="$(dirname "$0")/../deployment-records/active.json"

cd "$(dirname "$0")/.."

echo "════════════════════════════════════════"
echo "  CANARY PROMOTE — ${STELLAR_NETWORK}"
echo "  Steps: ${STEPS[*]}"
echo "  Interval: ${STEP_INTERVAL}s"
echo "════════════════════════════════════════"

for WEIGHT in "${STEPS[@]}"; do
  echo
  echo "── Setting canary weight to ${WEIGHT}% ──────────────────────────────────"
  bash scripts/canary_traffic.sh --set-weight "$WEIGHT"

  if [ "$WEIGHT" -lt 100 ]; then
    echo "   Waiting ${STEP_INTERVAL}s before health check…"
    sleep "$STEP_INTERVAL"
  fi

  echo "── Health check at ${WEIGHT}% ────────────────────────────────────────────"
  if ! bash scripts/canary_monitor.sh; then
    echo
    echo "🚨 Health check failed at ${WEIGHT}% — initiating rollback"
    ROLLBACK_REASON="health_check_failed_at_${WEIGHT}_percent" \
      bash scripts/canary_rollback.sh
    exit 1
  fi
done

# ─── Promote: canary becomes the new stable ───────────────────────────────────
echo
echo "── Promoting canary to stable ───────────────────────────────────────────"
python3 - <<EOF
import json, datetime

with open("$REGISTRY") as f:
    data = json.load(f)

canary_id = data["canary_contract_id"]
data["stable_contract_id"] = canary_id
data["canary_contract_id"] = ""
data["canary_weight"] = 0
data["status"] = "stable"
data["promoted_at"] = datetime.datetime.utcnow().isoformat() + "Z"

with open("$REGISTRY", "w") as f:
    json.dump(data, f, indent=2)

print(f"  New stable: {canary_id}")
EOF

echo
echo "════════════════════════════════════════"
echo "  ✅ Canary promoted to stable"
echo "════════════════════════════════════════"
