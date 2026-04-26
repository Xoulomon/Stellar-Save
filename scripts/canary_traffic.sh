#!/usr/bin/env bash
# scripts/canary_traffic.sh
# Reads deployment-records/active.json and prints the contract ID to use
# for a given request, based on the configured canary traffic weight.
#
# Usage:
#   CONTRACT_ID=$(bash scripts/canary_traffic.sh)
#
# Also supports updating the traffic weight:
#   bash scripts/canary_traffic.sh --set-weight 25
#
# Required env vars (for --set-weight):
#   none — reads/writes deployment-records/active.json directly
set -euo pipefail

REGISTRY="$(dirname "$0")/../deployment-records/active.json"

# ─── Update weight mode ───────────────────────────────────────────────────────
if [ "${1:-}" = "--set-weight" ]; then
  NEW_WEIGHT="${2:?Usage: canary_traffic.sh --set-weight <0-100>}"
  if ! [[ "$NEW_WEIGHT" =~ ^[0-9]+$ ]] || [ "$NEW_WEIGHT" -gt 100 ]; then
    echo "Error: weight must be 0-100" >&2; exit 1
  fi
  python3 - <<EOF
import json
with open("$REGISTRY") as f:
    data = json.load(f)
data["canary_weight"] = int("$NEW_WEIGHT")
if int("$NEW_WEIGHT") == 0:
    data["status"] = "stable"
elif int("$NEW_WEIGHT") == 100:
    data["status"] = "promoted"
with open("$REGISTRY", "w") as f:
    json.dump(data, f, indent=2)
print(f"Traffic weight updated to {data['canary_weight']}% (status: {data['status']})")
EOF
  exit 0
fi

# ─── Route mode: print the contract ID to use ────────────────────────────────
if [ ! -f "$REGISTRY" ]; then
  echo "Error: registry not found at $REGISTRY" >&2; exit 1
fi

python3 - <<'EOF'
import json, random, sys

with open(sys.argv[1]) as f:
    data = json.load(f)

stable  = data.get("stable_contract_id", "")
canary  = data.get("canary_contract_id", "")
weight  = int(data.get("canary_weight", 0))
status  = data.get("status", "stable")

if status == "promoted" or weight == 100:
    print(canary)
elif not canary or weight == 0 or status == "stable":
    print(stable)
else:
    # Weighted random routing
    print(canary if random.randint(1, 100) <= weight else stable)
EOF
"$REGISTRY"
