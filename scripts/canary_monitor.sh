#!/usr/bin/env bash
# scripts/canary_monitor.sh
# Health-checks the canary contract and compares error rate against thresholds.
# Exits 0 if healthy, 1 if thresholds are breached (triggers rollback).
#
# Required env vars:
#   STELLAR_NETWORK  — testnet | mainnet
#   STELLAR_RPC_URL  — RPC endpoint
#
# Optional:
#   MAX_ERROR_RATE          — max allowed error % (default: 5)
#   MIN_SAMPLE_SIZE         — min invocations before verdict (default: 10)
#   MAX_CONSECUTIVE_FAILURES — consecutive failures before fail (default: 3)
#   SMOKE_ACCOUNT           — Stellar key name for invocations (default: deployer)
set -euo pipefail

: "${STELLAR_NETWORK:?}"
: "${STELLAR_RPC_URL:?}"

MAX_ERROR_RATE="${MAX_ERROR_RATE:-5}"
MIN_SAMPLE_SIZE="${MIN_SAMPLE_SIZE:-10}"
MAX_CONSECUTIVE_FAILURES="${MAX_CONSECUTIVE_FAILURES:-3}"
SMOKE_ACCOUNT="${SMOKE_ACCOUNT:-deployer}"
REGISTRY="$(dirname "$0")/../deployment-records/active.json"
METRICS_FILE="$(dirname "$0")/../deployment-records/canary_metrics.json"

cd "$(dirname "$0")/.."
mkdir -p deployment-records

# ─── Read canary contract ID ──────────────────────────────────────────────────
if [ ! -f "$REGISTRY" ]; then
  echo "❌ Registry not found: $REGISTRY" >&2; exit 1
fi

CANARY_ID=$(python3 -c "
import json
d = json.load(open('$REGISTRY'))
print(d.get('canary_contract_id', ''))
")

if [ -z "$CANARY_ID" ]; then
  echo "❌ No canary contract ID in registry" >&2; exit 1
fi

echo "Monitoring canary: ${CANARY_ID} on ${STELLAR_NETWORK}"
echo

PASS=0; FAIL=0

invoke_canary() {
  stellar contract invoke \
    --id "$CANARY_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$SMOKE_ACCOUNT" \
    -- "$@" 2>&1
}

# ─── Health probe 1: RPC reachability ────────────────────────────────────────
if curl -sf --max-time 10 "$STELLAR_RPC_URL" -o /dev/null; then
  echo "✅ RPC reachable"; ((PASS++)) || true
else
  echo "❌ RPC unreachable"; ((FAIL++)) || true
fi

# ─── Health probe 2: Contract exists ─────────────────────────────────────────
if stellar contract info \
    --id "$CANARY_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" &>/dev/null; then
  echo "✅ Canary contract exists"; ((PASS++)) || true
else
  echo "❌ Canary contract not found"; ((FAIL++)) || true
fi

# ─── Health probe 3: Read-only invocation (get_group on non-existent group) ──
OUT=$(invoke_canary get_group --group_id 0 || true)
if echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
  echo "✅ get_group(0) returned expected error (contract responding)"; ((PASS++)) || true
else
  echo "❌ get_group(0) unexpected response: $OUT"; ((FAIL++)) || true
fi

# ─── Health probe 4: Testnet write-path ──────────────────────────────────────
if [ "$STELLAR_NETWORK" = "testnet" ]; then
  OUT=$(invoke_canary create_group \
    --contribution_amount 100 \
    --cycle_duration 86400 \
    --max_members 3 2>&1 || true)
  if echo "$OUT" | grep -qiE "^[0-9]+$|\"[0-9]+\"|completed"; then
    echo "✅ create_group succeeded"; ((PASS++)) || true
  elif echo "$OUT" | grep -qiE "(error|Error|HostError)"; then
    echo "❌ create_group failed: $OUT"; ((FAIL++)) || true
  else
    echo "✅ create_group invocation completed"; ((PASS++)) || true
  fi
fi

TOTAL=$((PASS + FAIL))
ERROR_RATE=0
if [ "$TOTAL" -gt 0 ]; then
  ERROR_RATE=$(python3 -c "print(round($FAIL / $TOTAL * 100, 1))")
fi

# ─── Write metrics ────────────────────────────────────────────────────────────
python3 - <<EOF
import json, datetime

metrics_file = "$METRICS_FILE"
try:
    with open(metrics_file) as f:
        metrics = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    metrics = {"checks": [], "consecutive_failures": 0}

healthy = $FAIL == 0
if healthy:
    metrics["consecutive_failures"] = 0
else:
    metrics["consecutive_failures"] = metrics.get("consecutive_failures", 0) + 1

metrics["checks"].append({
    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    "pass": $PASS,
    "fail": $FAIL,
    "error_rate": float("$ERROR_RATE"),
    "healthy": healthy
})
# Keep last 100 checks
metrics["checks"] = metrics["checks"][-100:]
metrics["last_check"] = datetime.datetime.utcnow().isoformat() + "Z"
metrics["canary_contract_id"] = "$CANARY_ID"

with open(metrics_file, "w") as f:
    json.dump(metrics, f, indent=2)

print(f"Consecutive failures: {metrics['consecutive_failures']}")
EOF

CONSECUTIVE=$(python3 -c "
import json
m = json.load(open('$METRICS_FILE'))
print(m.get('consecutive_failures', 0))
")

echo
echo "════════════════════════════════════════"
echo "  Checks: ${PASS} passed, ${FAIL} failed"
echo "  Error rate: ${ERROR_RATE}%  (threshold: ${MAX_ERROR_RATE}%)"
echo "  Consecutive failures: ${CONSECUTIVE}  (threshold: ${MAX_CONSECUTIVE_FAILURES})"
echo "════════════════════════════════════════"

# ─── Threshold evaluation ─────────────────────────────────────────────────────
BREACH=0

if [ "$TOTAL" -ge "$MIN_SAMPLE_SIZE" ]; then
  if python3 -c "exit(0 if float('$ERROR_RATE') > float('$MAX_ERROR_RATE') else 1)"; then
    echo "🚨 Error rate ${ERROR_RATE}% exceeds threshold ${MAX_ERROR_RATE}%"
    BREACH=1
  fi
fi

if [ "$CONSECUTIVE" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
  echo "🚨 ${CONSECUTIVE} consecutive failures exceeds threshold ${MAX_CONSECUTIVE_FAILURES}"
  BREACH=1
fi

if [ "$BREACH" -eq 1 ]; then
  echo "❌ Canary health check FAILED — rollback recommended"
  exit 1
fi

echo "✅ Canary is healthy"
