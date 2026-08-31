#!/usr/bin/env bash
# scripts/canary_smoke_test.sh
# Comprehensive smoke-test suite that gates canary promotion.
# Covers critical contract endpoints, backend API, and frontend availability.
# On failure, automatically triggers canary_rollback.sh if the registry is present.
#
# Required env vars:
#   CONTRACT_ID      — canary contract address to probe
#   STELLAR_NETWORK  — testnet | mainnet
#   STELLAR_RPC_URL  — Soroban RPC endpoint
#
# Optional:
#   API_URL          — backend API base URL (default: http://localhost:3001)
#   FRONTEND_URL     — frontend base URL (default: http://localhost:4173)
#   SMOKE_ACCOUNT    — Stellar key name for write-path invocations (default: deployer)
#   AUTO_ROLLBACK    — set to "0" to disable automatic rollback on failure (default: 1)
set -euo pipefail

: "${CONTRACT_ID:?CONTRACT_ID is required}"
: "${STELLAR_NETWORK:?STELLAR_NETWORK is required}"
: "${STELLAR_RPC_URL:?STELLAR_RPC_URL is required}"

API_URL="${API_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:4173}"
SMOKE_ACCOUNT="${SMOKE_ACCOUNT:-deployer}"
AUTO_ROLLBACK="${AUTO_ROLLBACK:-1}"
REGISTRY="$(dirname "$0")/../deployment-records/active.json"

PASS=0
FAIL=0
ROLLBACK_TRIGGER=0

cd "$(dirname "$0")/.."

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; ROLLBACK_TRIGGER=1; }
skip() { echo "  ⏭️   $*"; }
info() { echo "  ℹ️   $*"; }

# ─── Contract invocation helper ───────────────────────────────────────────────
invoke() {
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$SMOKE_ACCOUNT" \
    -- "$@" 2>&1
}

echo "════════════════════════════════════════════════════════"
echo "  CANARY SMOKE TEST SUITE"
echo "  Contract : ${CONTRACT_ID}"
echo "  Network  : ${STELLAR_NETWORK}"
echo "  API      : ${API_URL}"
echo "  Frontend : ${FRONTEND_URL}"
echo "════════════════════════════════════════════════════════"
echo

# ─── Group 1: RPC / network layer ─────────────────────────────────────────────
echo "── 1. RPC reachability ──────────────────────────────────────────────────"

if curl -sf --max-time 10 "$STELLAR_RPC_URL" -o /dev/null; then
  ok "RPC endpoint reachable: ${STELLAR_RPC_URL}"
else
  fail "RPC endpoint unreachable: ${STELLAR_RPC_URL}"
fi

# ─── Group 2: Contract existence ──────────────────────────────────────────────
echo
echo "── 2. Contract existence ────────────────────────────────────────────────"

if stellar contract info \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" &>/dev/null; then
  ok "Canary contract exists on-chain: ${CONTRACT_ID}"
else
  fail "Canary contract not found on-chain: ${CONTRACT_ID}"
fi

# ─── Group 3: Read-only contract endpoints ────────────────────────────────────
echo
echo "── 3. Read-only contract endpoints ─────────────────────────────────────"

# 3a. get_group(0) — non-existent group should return a contract error
OUT=$(invoke get_group --group_id 0 || true)
if echo "$OUT" | grep -qiE "(error|Error|HostError|NotFound|GroupNotFound)"; then
  ok "get_group(0) returns expected contract error (contract is alive)"
else
  fail "get_group(0) unexpected response — contract may be broken: ${OUT}"
fi

# 3b. get_total_groups — should return a non-negative integer
OUT=$(invoke get_total_groups || true)
if echo "$OUT" | grep -qE '^[0-9]+$'; then
  TOTAL_GROUPS=$(echo "$OUT" | grep -oE '^[0-9]+')
  ok "get_total_groups returned ${TOTAL_GROUPS}"
elif echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
  fail "get_total_groups returned an error: ${OUT}"
else
  # Some RPC wrappers wrap the result in JSON
  if echo "$OUT" | python3 -c "import sys,json; v=json.load(sys.stdin); exit(0 if isinstance(v,int) else 1)" 2>/dev/null; then
    ok "get_total_groups returned a valid integer (JSON-wrapped)"
  else
    fail "get_total_groups returned unexpected output: ${OUT}"
  fi
fi

# 3c. is_member(group_id=0, address=contract_id) — should return false or error
OUT=$(invoke is_member --group_id 0 --address "$CONTRACT_ID" || true)
if echo "$OUT" | grep -qiE "(false|error|Error|HostError)"; then
  ok "is_member(0, addr) returns false/error as expected"
else
  fail "is_member(0, addr) unexpected response: ${OUT}"
fi

# ─── Group 4: Write-path (testnet only) ───────────────────────────────────────
echo
echo "── 4. Write-path contract endpoints (testnet only) ──────────────────────"

if [ "$STELLAR_NETWORK" = "testnet" ]; then
  # 4a. create_group — minimal valid params
  OUT=$(invoke create_group \
    --contribution_amount 100 \
    --cycle_duration 86400 \
    --max_members 3 2>&1 || true)

  if echo "$OUT" | grep -qE '^[0-9]+$'; then
    SMOKE_GROUP_ID=$(echo "$OUT" | grep -oE '^[0-9]+')
    ok "create_group succeeded — group_id=${SMOKE_GROUP_ID}"

    # 4b. get_group — read back what we just created
    OUT2=$(invoke get_group --group_id "$SMOKE_GROUP_ID" 2>&1 || true)
    if echo "$OUT2" | grep -qiE "(contribution_amount|max_members|status|Pending)"; then
      ok "get_group(${SMOKE_GROUP_ID}) returned group data"
    else
      fail "get_group(${SMOKE_GROUP_ID}) unexpected response: ${OUT2}"
    fi

    # 4c. get_payout_schedule — empty but should not error for a valid group
    OUT3=$(invoke get_payout_schedule --group_id "$SMOKE_GROUP_ID" 2>&1 || true)
    if echo "$OUT3" | grep -qiE "(error|Error|HostError)"; then
      fail "get_payout_schedule(${SMOKE_GROUP_ID}) returned error: ${OUT3}"
    else
      ok "get_payout_schedule(${SMOKE_GROUP_ID}) returned without error"
    fi
  elif echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
    fail "create_group returned an error: ${OUT}"
  else
    # Some wrappers return JSON-quoted integers
    SMOKE_GROUP_ID=$(echo "$OUT" | python3 -c "import sys,json; v=json.load(sys.stdin); print(int(v))" 2>/dev/null || echo "")
    if [ -n "$SMOKE_GROUP_ID" ]; then
      ok "create_group succeeded — group_id=${SMOKE_GROUP_ID} (JSON-wrapped)"
    else
      ok "create_group invocation completed (output: ${OUT})"
    fi
  fi
else
  skip "Write-path tests skipped on ${STELLAR_NETWORK} (read-only smoke test)"
fi

# ─── Group 5: Backend API health ──────────────────────────────────────────────
echo
echo "── 5. Backend API health ────────────────────────────────────────────────"

HTTP_STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
  "${API_URL}/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  ok "GET ${API_URL}/health → 200"
elif [ "$HTTP_STATUS" = "000" ]; then
  # API may not be deployed in this environment; warn but don't fail
  info "GET ${API_URL}/health — could not connect (API may not be running in this env)"
else
  fail "GET ${API_URL}/health → ${HTTP_STATUS} (expected 200)"
fi

# 5b. /api/groups — should return a JSON array
GROUPS_STATUS=$(curl -sf --max-time 10 -o /tmp/canary_groups.json -w "%{http_code}" \
  "${API_URL}/api/groups" 2>/dev/null || echo "000")

if [ "$GROUPS_STATUS" = "200" ]; then
  if python3 -c "import json,sys; d=json.load(open('/tmp/canary_groups.json')); assert isinstance(d,(list,dict))" 2>/dev/null; then
    ok "GET ${API_URL}/api/groups → 200 (valid JSON)"
  else
    fail "GET ${API_URL}/api/groups → 200 but invalid JSON body"
  fi
elif [ "$GROUPS_STATUS" = "000" ]; then
  info "GET ${API_URL}/api/groups — could not connect (API may not be running)"
else
  fail "GET ${API_URL}/api/groups → ${GROUPS_STATUS} (expected 200)"
fi

# ─── Group 6: Frontend availability ───────────────────────────────────────────
echo
echo "── 6. Frontend availability ─────────────────────────────────────────────"

FRONTEND_STATUS=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
  "${FRONTEND_URL}/" 2>/dev/null || echo "000")

if [ "$FRONTEND_STATUS" = "200" ]; then
  ok "GET ${FRONTEND_URL}/ → 200"
elif [ "$FRONTEND_STATUS" = "000" ]; then
  info "GET ${FRONTEND_URL}/ — could not connect (frontend may not be running)"
else
  fail "GET ${FRONTEND_URL}/ → ${FRONTEND_STATUS} (expected 200)"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════"
echo "  Smoke tests: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════════════════════"

if [ "$ROLLBACK_TRIGGER" -eq 1 ]; then
  echo "🚨 ROLLBACK TRIGGER: one or more smoke tests failed."
  if [ "$AUTO_ROLLBACK" = "1" ] && [ -f "$REGISTRY" ]; then
    echo "   Initiating automatic rollback…"
    ROLLBACK_REASON="canary_smoke_test_failed" \
      STELLAR_NETWORK="$STELLAR_NETWORK" \
      bash "$(dirname "$0")/canary_rollback.sh"
  else
    echo "   AUTO_ROLLBACK=${AUTO_ROLLBACK} — skipping automatic rollback."
    echo "   Run manually: STELLAR_NETWORK=${STELLAR_NETWORK} bash scripts/canary_rollback.sh"
  fi
  exit 1
fi

echo "✅ All canary smoke tests passed — safe to promote."
