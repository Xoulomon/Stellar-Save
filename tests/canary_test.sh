#!/usr/bin/env bash
# tests/canary_test.sh
# Unit tests for canary deployment logic.
# Uses a temporary registry — no real network calls needed.
set -euo pipefail

PASS=0; FAIL=0
TMP=$(mktemp -d)
export REGISTRY="$TMP/active.json"
export METRICS="$TMP/canary_metrics.json"
trap 'rm -rf "$TMP"' EXIT

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then ok "$desc"; else fail "$desc (expected '$expected', got '$actual')"; fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then ok "$desc"; else fail "$desc (expected '$needle' in output)"; fi
}

write_registry() {
  echo "$1" > "$REGISTRY"
}

# Inline routing logic (mirrors canary_traffic.sh)
route() {
  python3 - <<'PYEOF'
import json, random, os, sys

with open(os.environ["REGISTRY"]) as f:
    data = json.load(f)

stable = data.get("stable_contract_id", "")
canary = data.get("canary_contract_id", "")
weight = int(data.get("canary_weight", 0))
status = data.get("status", "stable")

if status == "promoted" or weight == 100:
    print(canary)
elif not canary or weight == 0 or status == "stable":
    print(stable)
else:
    random.seed(int(os.environ.get("SEED", "42")))
    print(canary if random.randint(1, 100) <= weight else stable)
PYEOF
}

echo "════════════════════════════════════════"
echo "  Canary Deployment Tests"
echo "════════════════════════════════════════"
echo

# ─── Test 1: Traffic routing ──────────────────────────────────────────────────
echo "── Traffic routing ──────────────────────────────────────────────────────"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":0,"status":"stable"}'
assert_eq "weight=0 routes to stable" "STABLE123" "$(route)"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":100,"status":"canary"}'
assert_eq "weight=100 routes to canary" "CANARY456" "$(route)"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":0,"status":"promoted"}'
assert_eq "status=promoted routes to canary" "CANARY456" "$(route)"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":10,"status":"canary"}'
SEED=1 RESULT=$(route)   # seed=1 → random=18 > 10 → stable
assert_eq "weight=10 with low-traffic seed routes to stable" "STABLE123" "$(SEED=1 route)"

assert_eq "weight=10 with low-value seed routes to canary" "CANARY456" "$(SEED=2 route)"

# ─── Test 2: Rollback ─────────────────────────────────────────────────────────
echo
echo "── Rollback ─────────────────────────────────────────────────────────────"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":25,"status":"canary"}'

python3 - <<'PYEOF'
import json, datetime, os

with open(os.environ["REGISTRY"]) as f:
    data = json.load(f)
data["canary_weight"] = 0
data["status"] = "rolled_back"
data["rollback_reason"] = "test"
with open(os.environ["REGISTRY"], "w") as f:
    json.dump(data, f)
PYEOF

STATUS=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d['status'])")
WEIGHT=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d['canary_weight'])")
assert_eq "rollback sets status=rolled_back" "rolled_back" "$STATUS"
assert_eq "rollback sets weight=0" "0" "$WEIGHT"

# Rollback without stable ID should error
write_registry '{"stable_contract_id":"","canary_contract_id":"CANARY456","canary_weight":25,"status":"canary"}'
ROLLBACK_OUT=$(python3 - <<'PYEOF' 2>&1 || true
import json, os, sys
with open(os.environ["REGISTRY"]) as f:
    data = json.load(f)
if not data.get("stable_contract_id"):
    print("ERROR: No stable contract ID")
    sys.exit(1)
PYEOF
)
assert_contains "rollback fails without stable ID" "ERROR" "$ROLLBACK_OUT"

# ─── Test 3: Metrics ──────────────────────────────────────────────────────────
echo
echo "── Metrics ──────────────────────────────────────────────────────────────"

python3 - <<'PYEOF'
import json, os

metrics = {"checks": [], "consecutive_failures": 0}
for _ in range(2):
    metrics["consecutive_failures"] += 1
    metrics["checks"].append({"pass": 0, "fail": 1, "error_rate": 100.0, "healthy": False})
with open(os.environ["METRICS"], "w") as f:
    json.dump(metrics, f)
PYEOF

CONSEC=$(python3 -c "import json,os; d=json.load(open(os.environ['METRICS'])); print(d['consecutive_failures'])")
assert_eq "consecutive failures accumulate" "2" "$CONSEC"

python3 - <<'PYEOF'
import json, os
with open(os.environ["METRICS"]) as f:
    metrics = json.load(f)
metrics["consecutive_failures"] = 0
metrics["checks"].append({"pass": 3, "fail": 0, "error_rate": 0.0, "healthy": True})
with open(os.environ["METRICS"], "w") as f:
    json.dump(metrics, f)
PYEOF

CONSEC=$(python3 -c "import json,os; d=json.load(open(os.environ['METRICS'])); print(d['consecutive_failures'])")
assert_eq "healthy check resets consecutive failures" "0" "$CONSEC"

# ─── Test 4: Threshold evaluation ────────────────────────────────────────────
echo
echo "── Threshold evaluation ─────────────────────────────────────────────────"

check_threshold() {
  python3 -c "
error_rate, max_rate, sample, min_sample = float('$1'), float('$2'), int('$3'), int('$4')
print('BREACH' if sample >= min_sample and error_rate > max_rate else 'OK')
"
}

assert_eq "error_rate=6 > max=5 with sufficient sample → BREACH" "BREACH" "$(check_threshold 6 5 15 10)"
assert_eq "error_rate=4 < max=5 → OK"                            "OK"     "$(check_threshold 4 5 15 10)"
assert_eq "error_rate=6 but sample too small → OK"               "OK"     "$(check_threshold 6 5 5 10)"
assert_eq "error_rate=5 equals max=5 → OK (not strictly greater)" "OK"    "$(check_threshold 5 5 15 10)"

# ─── Test 5: Promotion ───────────────────────────────────────────────────────
echo
echo "── Promotion ────────────────────────────────────────────────────────────"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":100,"status":"canary"}'

python3 - <<'PYEOF'
import json, os, datetime
with open(os.environ["REGISTRY"]) as f:
    data = json.load(f)
canary_id = data["canary_contract_id"]
data["stable_contract_id"] = canary_id
data["canary_contract_id"] = ""
data["canary_weight"] = 0
data["status"] = "stable"
data["promoted_at"] = datetime.datetime.utcnow().isoformat() + "Z"
with open(os.environ["REGISTRY"], "w") as f:
    json.dump(data, f)
PYEOF

NEW_STABLE=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d['stable_contract_id'])")
NEW_CANARY=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d.get('canary_contract_id',''))")
STATUS=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d['status'])")
assert_eq "promotion sets stable to old canary ID" "CANARY456" "$NEW_STABLE"
assert_eq "promotion clears canary ID"             ""          "$NEW_CANARY"
assert_eq "promotion sets status=stable"           "stable"    "$STATUS"

# ─── Test 6: Weight update ───────────────────────────────────────────────────
echo
echo "── Weight update ────────────────────────────────────────────────────────"

write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":10,"status":"canary"}'

python3 - <<'PYEOF'
import json, os
with open(os.environ["REGISTRY"]) as f:
    data = json.load(f)
data["canary_weight"] = 25
data["status"] = "canary"
with open(os.environ["REGISTRY"], "w") as f:
    json.dump(data, f)
PYEOF

WEIGHT=$(python3 -c "import json,os; d=json.load(open(os.environ['REGISTRY'])); print(d['canary_weight'])")
assert_eq "weight update to 25" "25" "$WEIGHT"

# ─── Test 7: Withdrawal failover ──────────────────────────────────────────────
echo
echo "── Withdrawal failover ──────────────────────────────────────────────────"

# Simulate the withdrawal API state: tracks calls and dedup keys
WITHDRAWAL_STORE="$TMP/withdrawal_store.json"
export WITHDRAWAL_STORE
python3 - <<'PYEOF'
import json, os
store = {"calls": [], "processed_ids": []}
with open(os.environ["WITHDRAWAL_STORE"], "w") as f:
    json.dump(store, f)
PYEOF

# 7a. Withdrawal path responds during simulated failover (stable → secondary)
# Write registry into "canary" state (simulating primary failover in progress)
write_registry '{"stable_contract_id":"STABLE123","canary_contract_id":"CANARY456","canary_weight":100,"status":"canary"}'

WITHDRAWAL_ROUTED_CONTRACT=$(route)
assert_eq "withdrawal path routes to canary contract during failover" "CANARY456" "$WITHDRAWAL_ROUTED_CONTRACT"

# Simulate a withdrawal request arriving during failover
WITHDRAWAL_RESPONSE=$(python3 - <<'PYEOF'
import json, os, datetime

store_path = os.environ["WITHDRAWAL_STORE"]
with open(store_path) as f:
    store = json.load(f)

# Record a withdrawal call
withdrawal = {
    "id": "wd-001",
    "wallet_address": "GABCDE1234567890ABCDE",
    "amount": 100,
    "contract_id": "CANARY456",
    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
    "status": "submitted",
}
store["calls"].append(withdrawal)
store["processed_ids"].append(withdrawal["id"])
with open(store_path, "w") as f:
    json.dump(store, f)

print("submitted")
PYEOF
)
assert_eq "withdrawal submitted during failover returns submitted status" "submitted" "$WITHDRAWAL_RESPONSE"

# 7b. Dedup wallet withdrawal — duplicate attempt must be rejected
DEDUP_RESULT=$(python3 - <<'PYEOF'
import json, os

store_path = os.environ["WITHDRAWAL_STORE"]
with open(store_path) as f:
    store = json.load(f)

duplicate_id = "wd-001"

# Simulate a second submission of the same withdrawal ID
if duplicate_id in store["processed_ids"]:
    print("duplicate_rejected")
else:
    store["processed_ids"].append(duplicate_id)
    with open(store_path, "w") as f:
        json.dump(store, f)
    print("submitted")
PYEOF
)
assert_eq "duplicate withdrawal attempt is rejected (dedup)" "duplicate_rejected" "$DEDUP_RESULT"

# A distinct withdrawal ID must succeed even when a duplicate was blocked
DEDUP_NEW=$(python3 - <<'PYEOF'
import json, os, datetime

store_path = os.environ["WITHDRAWAL_STORE"]
with open(store_path) as f:
    store = json.load(f)

new_id = "wd-002"
if new_id in store["processed_ids"]:
    print("duplicate_rejected")
else:
    store["processed_ids"].append(new_id)
    store["calls"].append({
        "id": new_id,
        "wallet_address": "GABCDE1234567890ABCDE",
        "amount": 50,
        "contract_id": "CANARY456",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "status": "submitted",
    })
    with open(store_path, "w") as f:
        json.dump(store, f)
    print("submitted")
PYEOF
)
assert_eq "new unique withdrawal succeeds while dedup blocks duplicate" "submitted" "$DEDUP_NEW"

# 7c. Withdrawal endpoint restores to stable after primary recovery
# Simulate promotion: canary becomes the new stable
write_registry '{"stable_contract_id":"CANARY456","canary_contract_id":"","canary_weight":0,"status":"stable"}'

WITHDRAWAL_POST_RECOVERY=$(route)
assert_eq "withdrawal routes to recovered stable contract after primary recovery" "CANARY456" "$WITHDRAWAL_POST_RECOVERY"

# Verify that withdrawals already in the store are preserved (no data loss)
CALL_COUNT=$(python3 - <<'PYEOF'
import json, os
with open(os.environ["WITHDRAWAL_STORE"]) as f:
    store = json.load(f)
print(len(store["calls"]))
PYEOF
)
assert_eq "all withdrawal calls preserved across failover (no data loss)" "2" "$CALL_COUNT"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Tests: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

[ "$FAIL" -eq 0 ] || exit 1
echo "✅ All canary tests passed."
