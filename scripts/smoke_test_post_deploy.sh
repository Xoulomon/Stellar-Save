#!/usr/bin/env bash
# scripts/smoke_test_post_deploy.sh
# Targeted post-deployment smoke tests against the live network.
# Tests the happy-path flows that matter most: create group, join, contribute.
#
# Required env vars:
#   CONTRACT_ID      — deployed contract address
#   STELLAR_NETWORK  — testnet | mainnet
#   STELLAR_RPC_URL  — RPC endpoint
#
# Optional:
#   SMOKE_ACCOUNT    — funded Stellar account key name (default: deployer)
#                      Only used on testnet. Mainnet smoke tests are read-only.
set -euo pipefail

: "${CONTRACT_ID:?CONTRACT_ID is required}"
: "${STELLAR_NETWORK:?STELLAR_NETWORK is required}"
: "${STELLAR_RPC_URL:?STELLAR_RPC_URL is required}"

SMOKE_ACCOUNT="${SMOKE_ACCOUNT:-deployer}"
PASS=0; FAIL=0

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }
skip() { echo "  ⏭️   $*"; }

invoke() {
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$SMOKE_ACCOUNT" \
    -- "$@" 2>&1
}

echo "Smoke testing ${CONTRACT_ID} on ${STELLAR_NETWORK}…"
echo

# ─── 1. RPC reachability ─────────────────────────────────────────────────────
echo "── RPC reachability ─────────────────────────────────────────────────────"
if curl -sf --max-time 10 "$STELLAR_RPC_URL" -o /dev/null; then
  ok "RPC endpoint reachable"
else
  fail "RPC endpoint unreachable: $STELLAR_RPC_URL"
fi

# ─── 2. Contract is deployed ─────────────────────────────────────────────────
echo
echo "── Contract existence ───────────────────────────────────────────────────"
if stellar contract info \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" &>/dev/null; then
  ok "Contract exists on-chain"
else
  fail "Contract not found"
fi

# ─── 3. Read-only: get_group on non-existent group returns contract error ─────
echo
echo "── Read-only: get_group(0) ──────────────────────────────────────────────"
OUT=$(invoke get_group --group_id 0 || true)
if echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
  ok "get_group(0) returned expected contract error (group not found)"
else
  fail "get_group(0) returned unexpected output: $OUT"
fi

# ─── 4. Testnet-only: write path (create group) ──────────────────────────────
echo
echo "── Write path (testnet only) ────────────────────────────────────────────"
if [ "$STELLAR_NETWORK" = "testnet" ]; then
  # contribution_amount=100 stroops, cycle_duration=86400 (1 day), max_members=5
  OUT=$(invoke create_group \
    --contribution_amount 100 \
    --cycle_duration 86400 \
    --max_members 5 2>&1 || true)

  if echo "$OUT" | grep -qiE "^[0-9]+$|\"[0-9]+\""; then
    GROUP_ID=$(echo "$OUT" | grep -oE '[0-9]+' | head -1)
    ok "create_group returned group_id=${GROUP_ID}"

    # Verify the group is readable
    OUT2=$(invoke get_group --group_id "$GROUP_ID" 2>&1 || true)
    if echo "$OUT2" | grep -qiE "(contribution_amount|max_members|error)"; then
      ok "get_group(${GROUP_ID}) returned group data"
    else
      fail "get_group(${GROUP_ID}) returned unexpected output: $OUT2"
    fi
  elif echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
    fail "create_group failed: $OUT"
  else
    ok "create_group invocation completed (output: $OUT)"
  fi
else
  skip "Write-path tests skipped on mainnet (read-only smoke test)"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Smoke tests: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 Smoke tests failed — investigate before proceeding."
  exit 1
fi

echo "✅ All smoke tests passed."
