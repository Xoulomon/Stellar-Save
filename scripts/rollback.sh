#!/usr/bin/env bash
# scripts/rollback.sh
# Re-deploys a previous WASM from a GitHub Actions artifact.
# Triggered manually via workflow_dispatch with rollback_artifact set.
#
# Required env vars:
#   STELLAR_NETWORK          — testnet | mainnet
#   STELLAR_RPC_URL          — RPC endpoint
#   ROLLBACK_ARTIFACT_RUN_ID — GitHub Actions run ID whose WASM to restore
#   DEPLOYER_SECRET          — Stellar secret key for the deployer account
#   GH_TOKEN                 — GitHub token with actions:read scope
#   REPO                     — owner/repo  (e.g. Xoulomon/Stellar-Save)
set -euo pipefail

: "${STELLAR_NETWORK:?}"
: "${STELLAR_RPC_URL:?}"
: "${ROLLBACK_ARTIFACT_RUN_ID:?}"
: "${DEPLOYER_SECRET:?}"
: "${GH_TOKEN:?}"
: "${REPO:?}"

WASM_DIR="$(mktemp -d)"
trap 'rm -rf "$WASM_DIR"' EXIT

echo "════════════════════════════════════════"
echo "  ROLLBACK — ${STELLAR_NETWORK}"
echo "  Source run: ${ROLLBACK_ARTIFACT_RUN_ID}"
echo "════════════════════════════════════════"
echo

# ─── 1. Download WASM artifact from the target run ───────────────────────────
echo "── Fetching artifact from run ${ROLLBACK_ARTIFACT_RUN_ID} ──────────────"

ARTIFACT_URL=$(curl -sf \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/actions/runs/${ROLLBACK_ARTIFACT_RUN_ID}/artifacts" \
  | python3 -c "
import sys, json
arts = json.load(sys.stdin)['artifacts']
# Prefer the wasm artifact; fall back to first match
for a in arts:
    if a['name'].startswith('wasm-'):
        print(a['archive_download_url'])
        break
" 2>/dev/null || echo "")

if [ -z "$ARTIFACT_URL" ]; then
  echo "❌ No WASM artifact found in run ${ROLLBACK_ARTIFACT_RUN_ID}"
  exit 1
fi

echo "  Downloading: ${ARTIFACT_URL}"
curl -sL \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -o "$WASM_DIR/wasm.zip" \
  "$ARTIFACT_URL"

unzip -q "$WASM_DIR/wasm.zip" -d "$WASM_DIR"
WASM_FILE=$(find "$WASM_DIR" -name "*.wasm" | head -1)

if [ -z "$WASM_FILE" ]; then
  echo "❌ No .wasm file found in artifact"
  exit 1
fi

ROLLBACK_HASH=$(sha256sum "$WASM_FILE" | awk '{print $1}')
echo "  WASM file : $WASM_FILE"
echo "  WASM hash : $ROLLBACK_HASH"

# ─── 2. Configure deployer identity ─────────────────────────────────────────
echo
echo "── Configuring deployer identity ────────────────────────────────────────"
echo "$DEPLOYER_SECRET" | stellar keys add rollback-deployer --secret-key --stdin
echo "  Identity configured"

# ─── 3. Deploy the previous WASM ─────────────────────────────────────────────
echo
echo "── Deploying rollback WASM to ${STELLAR_NETWORK} ────────────────────────"
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_FILE" \
  --network "$STELLAR_NETWORK" \
  --rpc-url "$STELLAR_RPC_URL" \
  --source-account rollback-deployer \
  --ignore-checks)

echo "  New contract ID: ${CONTRACT_ID}"

# ─── 4. Verify the rollback deployment ───────────────────────────────────────
echo
echo "── Verifying rollback ───────────────────────────────────────────────────"
export CONTRACT_ID STELLAR_NETWORK STELLAR_RPC_URL
export EXPECTED_WASM_HASH="$ROLLBACK_HASH"
bash "$(dirname "$0")/verify_contract.sh"

# ─── 5. Run smoke tests ───────────────────────────────────────────────────────
echo
echo "── Post-rollback smoke tests ────────────────────────────────────────────"
bash "$(dirname "$0")/smoke_test_post_deploy.sh"

echo
echo "════════════════════════════════════════"
echo "  ✅ Rollback complete"
echo "  Network     : ${STELLAR_NETWORK}"
echo "  Contract ID : ${CONTRACT_ID}"
echo "  WASM hash   : ${ROLLBACK_HASH}"
echo "  Source run  : ${ROLLBACK_ARTIFACT_RUN_ID}"
echo "════════════════════════════════════════"
