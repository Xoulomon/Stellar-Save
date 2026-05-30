#!/usr/bin/env bash
# scripts/canary_deploy.sh
# Deploys a new contract version as a canary alongside the stable contract.
# Updates deployment-records/active.json with both IDs and initial traffic weight.
#
# Required env vars:
#   STELLAR_NETWORK   — testnet | mainnet
#   STELLAR_RPC_URL   — RPC endpoint
#   DEPLOYER_SECRET   — Stellar secret key for the deployer account
#
# Optional:
#   CANARY_WEIGHT     — initial traffic % for canary (default: 10)
#   WASM_PATH         — path to WASM file (default: built from source)
set -euo pipefail

: "${STELLAR_NETWORK:?}"
: "${STELLAR_RPC_URL:?}"
: "${DEPLOYER_SECRET:?}"

CANARY_WEIGHT="${CANARY_WEIGHT:-10}"
WASM_PATH="${WASM_PATH:-target/wasm32-unknown-unknown/release/stellar_save.wasm}"
REGISTRY="deployment-records/active.json"

cd "$(dirname "$0")/.."
mkdir -p deployment-records

echo "════════════════════════════════════════"
echo "  CANARY DEPLOY — ${STELLAR_NETWORK}"
echo "  Traffic weight: ${CANARY_WEIGHT}%"
echo "════════════════════════════════════════"

# ─── 1. Build if WASM not present ────────────────────────────────────────────
if [ ! -f "$WASM_PATH" ]; then
  echo "── Building WASM ────────────────────────────────────────────────────────"
  cargo build \
    --manifest-path contracts/stellar-save/Cargo.toml \
    --target wasm32-unknown-unknown \
    --release
fi

CANARY_HASH=$(sha256sum "$WASM_PATH" | awk '{print $1}')
echo "WASM hash: ${CANARY_HASH}"

# ─── 2. Configure deployer identity ──────────────────────────────────────────
echo "$DEPLOYER_SECRET" | stellar keys add canary-deployer --secret-key --stdin 2>/dev/null || true

# ─── 3. Read current stable contract ID from registry ────────────────────────
STABLE_CONTRACT_ID=""
if [ -f "$REGISTRY" ]; then
  STABLE_CONTRACT_ID=$(python3 -c "
import json, sys
d = json.load(open('$REGISTRY'))
print(d.get('stable_contract_id', ''))
" 2>/dev/null || echo "")
fi

if [ -z "$STABLE_CONTRACT_ID" ]; then
  echo "⚠️  No stable contract found in registry. Deploying canary as initial stable."
fi

# ─── 4. Deploy canary contract ───────────────────────────────────────────────
echo
echo "── Deploying canary contract ────────────────────────────────────────────"
CANARY_CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --network "$STELLAR_NETWORK" \
  --rpc-url "$STELLAR_RPC_URL" \
  --source-account canary-deployer \
  --ignore-checks)

echo "Canary contract ID: ${CANARY_CONTRACT_ID}"

# ─── 5. Write registry ───────────────────────────────────────────────────────
echo
echo "── Updating registry ────────────────────────────────────────────────────"
python3 - <<EOF
import json, datetime

registry = "$REGISTRY"
try:
    with open(registry) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {}

data.update({
    "stable_contract_id": "${STABLE_CONTRACT_ID:-$CANARY_CONTRACT_ID}",
    "canary_contract_id": "$CANARY_CONTRACT_ID",
    "canary_weight": int("$CANARY_WEIGHT"),
    "canary_wasm_hash": "$CANARY_HASH",
    "canary_deployed_at": datetime.datetime.utcnow().isoformat() + "Z",
    "network": "$STELLAR_NETWORK",
    "status": "canary"
})

with open(registry, "w") as f:
    json.dump(data, f, indent=2)
print(json.dumps(data, indent=2))
EOF

echo
echo "════════════════════════════════════════"
echo "  ✅ Canary deployed"
echo "  Stable  : ${STABLE_CONTRACT_ID:-$CANARY_CONTRACT_ID}"
echo "  Canary  : ${CANARY_CONTRACT_ID}"
echo "  Weight  : ${CANARY_WEIGHT}%"
echo "════════════════════════════════════════"
