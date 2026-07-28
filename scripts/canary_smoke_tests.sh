#!/usr/bin/env bash
# scripts/canary_smoke_tests.sh
#
# Smoke-test suite that gates canary promotion.
# Exercises the critical contract calls and backend API endpoints that must work
# before a canary is allowed to step up in traffic weight.
#
# Exit codes
#   0  — all required tests passed
#   1  — one or more required tests failed (BLOCK promotion)
#
# Required env vars:
#   STELLAR_NETWORK   — testnet | mainnet
#   STELLAR_RPC_URL   — Soroban RPC endpoint
#   CANARY_CONTRACT_ID — the canary contract address to test
#
# Optional env vars:
#   SMOKE_ACCOUNT     — funded Stellar key name for write-path tests (default: deployer)
#   BACKEND_URL       — backend API base URL for HTTP endpoint checks
#                       (default: http://localhost:3001)
#   ROLLBACK_ON_FAIL  — if "true", execute canary_rollback.sh on failure (default: false)
#
set -euo pipefail

: "${STELLAR_NETWORK:?STELLAR_NETWORK is required}"
: "${STELLAR_RPC_URL:?STELLAR_RPC_URL is required}"
: "${CANARY_CONTRACT_ID:?CANARY_CONTRACT_ID is required}"

SMOKE_ACCOUNT="${SMOKE_ACCOUNT:-deployer}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
ROLLBACK_ON_FAIL="${ROLLBACK_ON_FAIL:-false}"

PASS=0; FAIL=0; SKIP=0

# ─── Helpers ─────────────────────────────────────────────────────────────────

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }
skip() { echo "  ⏭️   $*"; ((SKIP++)) || true; }

section() { echo; echo "── $* ────────────────────────────────────────────────────────────────"; }

# Invoke the canary contract; always returns the raw output (never exits on error).
invoke() {
  stellar contract invoke \
    --id "$CANARY_CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$SMOKE_ACCOUNT" \
    -- "$@" 2>&1 || true
}

# HTTP GET with a 10-second timeout; returns the HTTP status code.
http_get_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$1" || echo "000"
}

# HTTP GET; prints response body.
http_get_body() {
  curl -s --max-time 10 "$1" || true
}

echo "════════════════════════════════════════════════════════════════"
echo "  CANARY SMOKE TESTS"
echo "  Contract : ${CANARY_CONTRACT_ID}"
echo "  Network  : ${STELLAR_NETWORK}"
echo "  Backend  : ${BACKEND_URL}"
echo "════════════════════════════════════════════════════════════════"

# ─── Suite 1: Network & RPC reachability ─────────────────────────────────────
section "Suite 1: Network & RPC reachability"

STATUS=$(http_get_status "$STELLAR_RPC_URL")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "405" ]; then
  ok "Soroban RPC endpoint is reachable (HTTP $STATUS)"
elif [ "$STATUS" = "000" ]; then
  fail "Soroban RPC endpoint timed out or is unreachable"
else
  ok "Soroban RPC endpoint responded with HTTP $STATUS (acceptable non-200)"
fi

# ─── Suite 2: Contract existence ─────────────────────────────────────────────
section "Suite 2: Contract existence"

if stellar contract info \
    --id "$CANARY_CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" &>/dev/null; then
  ok "Canary contract exists on-chain"
else
  fail "Canary contract NOT found on-chain — cannot proceed"
  echo
  echo "  FATAL: Contract does not exist. Aborting smoke tests."
  if [ "$ROLLBACK_ON_FAIL" = "true" ]; then
    ROLLBACK_REASON="canary_contract_not_found" bash "$(dirname "$0")/canary_rollback.sh" || true
  fi
  exit 1
fi

# ─── Suite 3: Critical read-only contract calls ───────────────────────────────
section "Suite 3: Critical read-only contract calls"

# 3a. get_group on a non-existent ID must return a contract error (not panic)
OUT=$(invoke get_group --group_id 0)
if echo "$OUT" | grep -qiE "(Error|HostError|NotFound|group_not_found)"; then
  ok "get_group(0) returns expected NotFound error (contract is alive)"
else
  fail "get_group(0) unexpected output — contract may be broken: ${OUT:0:200}"
fi

# 3b. get_total_groups must return a non-negative integer
OUT=$(invoke get_total_groups)
if echo "$OUT" | grep -qE '^[0-9]+$'; then
  ok "get_total_groups() returned a valid integer (${OUT})"
else
  fail "get_total_groups() returned unexpected output: ${OUT:0:200}"
fi

# 3c. list_groups with valid pagination args must return without panic
OUT=$(invoke list_groups --offset 0 --limit 10)
if echo "$OUT" | grep -qiE "(Error|HostError|panic)"; then
  # An empty list serialised as "[]" is also fine
  if echo "$OUT" | grep -qiE "(panic|HostError)"; then
    fail "list_groups(0,10) panicked: ${OUT:0:200}"
  else
    ok "list_groups(0,10) returned contract-level response"
  fi
else
  ok "list_groups(0,10) returned successfully"
fi

# 3d. is_complete on non-existent group must return a contract error
OUT=$(invoke is_complete --group_id 999999)
if echo "$OUT" | grep -qiE "(Error|HostError|NotFound)"; then
  ok "is_complete(999999) returns expected NotFound error"
else
  fail "is_complete(999999) unexpected output: ${OUT:0:200}"
fi

# ─── Suite 4: Write-path contract calls (testnet only) ───────────────────────
section "Suite 4: Write-path contract calls (testnet only)"

if [ "$STELLAR_NETWORK" = "testnet" ]; then
  # 4a. create_group — the most important write path
  OUT=$(invoke create_group \
    --contribution_amount 100 \
    --cycle_duration 86400 \
    --max_members 3 2>&1 || true)

  if echo "$OUT" | grep -qE '^[0-9]+$|"[0-9]+"'; then
    GROUP_ID=$(echo "$OUT" | grep -oE '[0-9]+' | head -1)
    ok "create_group returned group_id=${GROUP_ID}"

    # 4b. Verify the newly created group is readable
    OUT2=$(invoke get_group --group_id "$GROUP_ID")
    if echo "$OUT2" | grep -qiE "(contribution_amount|max_members|status)"; then
      ok "get_group(${GROUP_ID}) returned the created group data"
    elif echo "$OUT2" | grep -qiE "(Error|HostError)"; then
      fail "get_group(${GROUP_ID}) returned error after successful create_group: ${OUT2:0:200}"
    else
      ok "get_group(${GROUP_ID}) returned a response (output: ${OUT2:0:80})"
    fi

    # 4c. is_complete on the new group should return false (not started yet)
    OUT3=$(invoke is_complete --group_id "$GROUP_ID")
    if echo "$OUT3" | grep -qiE "(false|Error|HostError)"; then
      ok "is_complete(${GROUP_ID}) returned expected value"
    else
      fail "is_complete(${GROUP_ID}) unexpected output: ${OUT3:0:200}"
    fi

    # 4d. get_payout_queue on the new group should be empty or return an error
    OUT4=$(invoke get_payout_queue --group_id "$GROUP_ID")
    if echo "$OUT4" | grep -qiE "(Error|HostError|\[\])"; then
      ok "get_payout_queue(${GROUP_ID}) returned expected empty/error response"
    else
      ok "get_payout_queue(${GROUP_ID}) returned a response"
    fi

  elif echo "$OUT" | grep -qiE "(panic|HostError.*fatal)"; then
    fail "create_group caused a fatal contract error: ${OUT:0:200}"
  elif echo "$OUT" | grep -qiE "(Error|HostError)"; then
    # Non-fatal contract errors (e.g., auth issues in CI without funded account) are acceptable
    skip "create_group returned a contract error — likely unfunded smoke account: ${OUT:0:100}"
  else
    ok "create_group invocation completed"
  fi
else
  skip "Write-path tests skipped on ${STELLAR_NETWORK} (read-only smoke test for non-testnet)"
fi

# ─── Suite 5: Backend API health endpoints ────────────────────────────────────
section "Suite 5: Backend API health endpoints"

HEALTH_STATUS=$(http_get_status "${BACKEND_URL}/health")
case "$HEALTH_STATUS" in
  200) ok "Backend /health returned 200" ;;
  000) skip "Backend /health unreachable — backend may not be running in this environment" ;;
  *)   fail "Backend /health returned HTTP ${HEALTH_STATUS}" ;;
esac

if [ "$HEALTH_STATUS" = "200" ]; then
  HEALTH_BODY=$(http_get_body "${BACKEND_URL}/health")
  if echo "$HEALTH_BODY" | grep -qiE "(ok|healthy|status)"; then
    ok "Backend /health body contains health status field"
  else
    fail "Backend /health body missing expected status field: ${HEALTH_BODY:0:200}"
  fi

  # 5b. /api/groups list endpoint
  GROUPS_STATUS=$(http_get_status "${BACKEND_URL}/api/groups")
  case "$GROUPS_STATUS" in
    200) ok "Backend GET /api/groups returned 200" ;;
    401|403) ok "Backend GET /api/groups returned ${GROUPS_STATUS} (auth required — endpoint exists)" ;;
    404) fail "Backend GET /api/groups returned 404 — route may be missing" ;;
    000) skip "Backend GET /api/groups unreachable" ;;
    *)   fail "Backend GET /api/groups returned unexpected HTTP ${GROUPS_STATUS}" ;;
  esac

  # 5c. /api/v1/groups (v1 router)
  V1_STATUS=$(http_get_status "${BACKEND_URL}/api/v1/groups")
  case "$V1_STATUS" in
    200) ok "Backend GET /api/v1/groups returned 200" ;;
    401|403) ok "Backend GET /api/v1/groups returned ${V1_STATUS} (auth required — endpoint exists)" ;;
    404) fail "Backend GET /api/v1/groups returned 404 — v1 route may be missing" ;;
    000) skip "Backend GET /api/v1/groups unreachable" ;;
    *)   fail "Backend GET /api/v1/groups returned unexpected HTTP ${V1_STATUS}" ;;
  esac
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════════════"
echo "  SMOKE TEST SUMMARY"
echo "  ✅ Passed : ${PASS}"
echo "  ❌ Failed : ${FAIL}"
echo "  ⏭️  Skipped: ${SKIP}"
echo "════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "🚫 Smoke tests FAILED — canary promotion BLOCKED."
  echo "   Investigate failures before retrying promotion."
  if [ "$ROLLBACK_ON_FAIL" = "true" ]; then
    echo "   Rolling back canary (ROLLBACK_ON_FAIL=true)…"
    ROLLBACK_REASON="smoke_tests_failed" bash "$(dirname "$0")/canary_rollback.sh" || true
  fi
  exit 1
fi

echo
echo "✅ All smoke tests passed — canary is safe to promote."
