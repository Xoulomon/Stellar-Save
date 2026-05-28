#!/usr/bin/env bash
# tests/size_check_test.sh
# Unit tests for check_contract_size.sh logic.
# Uses synthetic WASM files — no real build needed.
set -euo pipefail

PASS=0; FAIL=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }
assert_eq() {
  [ "$2" = "$3" ] && ok "$1" || fail "$1 (expected '$2', got '$3')"
}
assert_contains() {
  echo "$3" | grep -q "$2" && ok "$1" || fail "$1 (expected '$2' in output)"
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
make_wasm() {
  # Create a synthetic file of exactly $1 bytes
  dd if=/dev/zero bs=1 count="$1" of="$TMP/stellar_save.wasm" 2>/dev/null
}

run_check() {
  WASM_PATH="$TMP/stellar_save.wasm" \
  WASM_SIZE_LIMIT_KB="${1:-100}" \
  WARN_THRESHOLD_PCT="${2:-80}" \
  GIT_SHA="test-sha" \
  bash "$(dirname "$0")/../scripts/check_contract_size.sh" 2>&1
}

echo "════════════════════════════════════════"
echo "  Contract Size Check Tests"
echo "════════════════════════════════════════"
echo

# ─── Test 1: Well within limit → OK (✅ icon) ────────────────────────────────
echo "── Status: OK ───────────────────────────────────────────────────────────"
make_wasm $(( 50 * 1024 ))   # 50 KB
OUT=$(run_check 100 80)
assert_contains "50 KB file shows ✅ icon"  "✅"    "$OUT"
assert_contains "50 KB file shows size"     "50 KB" "$OUT"

# ─── Test 2: Above warn threshold → WARN (⚠️ icon) ───────────────────────────
echo
echo "── Status: WARN ─────────────────────────────────────────────────────────"
make_wasm $(( 85 * 1024 ))   # 85 KB (> 80% of 100 KB)
OUT=$(run_check 100 80)
assert_contains "85 KB file shows ⚠️ icon"  "⚠"    "$OUT"

# ─── Test 3: Exceeds limit → FAIL (🚨 icon) + exit 1 ─────────────────────────
echo
echo "── Status: FAIL ─────────────────────────────────────────────────────────"
make_wasm $(( 105 * 1024 ))  # 105 KB
OUT=$(run_check 100 80 || true)
assert_contains "105 KB file shows 🚨 icon"         "🚨"      "$OUT"
assert_contains "105 KB file shows blocked message" "blocked" "$OUT"

# Confirm exit code is 1
if ! WASM_PATH="$TMP/stellar_save.wasm" WASM_SIZE_LIMIT_KB=100 WARN_THRESHOLD_PCT=80 GIT_SHA=test \
     bash "$(dirname "$0")/../scripts/check_contract_size.sh" &>/dev/null; then
  ok "exit code is 1 when limit exceeded"
else
  fail "should exit 1 when limit exceeded"
fi

# ─── Test 4: History is written ───────────────────────────────────────────────
echo
echo "── History tracking ─────────────────────────────────────────────────────"
make_wasm $(( 60 * 1024 ))
WASM_PATH="$TMP/stellar_save.wasm" \
WASM_SIZE_LIMIT_KB=100 \
WARN_THRESHOLD_PCT=80 \
GIT_SHA=abc123 \
bash "$(dirname "$0")/../scripts/check_contract_size.sh" &>/dev/null

HISTORY="$(dirname "$0")/../deployment-records/size_history.json"
if [ -f "$HISTORY" ]; then
  SHA_IN_HISTORY=$(python3 -c "
import json
entries = json.load(open('$HISTORY'))
print(entries[-1]['sha'])
")
  assert_eq "history records the commit SHA" "abc123" "$SHA_IN_HISTORY"
  ok "size_history.json was created"
else
  fail "size_history.json was not created"
fi

# ─── Test 5: Report markdown is written ──────────────────────────────────────
echo
echo "── Report generation ────────────────────────────────────────────────────"
make_wasm $(( 60 * 1024 ))
run_check 100 80 &>/dev/null || true

REPORT="$(dirname "$0")/../deployment-records/size_report.md"
if [ -f "$REPORT" ]; then
  ok "size_report.md was created"
  assert_contains "report contains size table" "Size" "$(cat "$REPORT")"
  assert_contains "report contains limit"      "100"  "$(cat "$REPORT")"
else
  fail "size_report.md was not created"
fi

# ─── Test 6: Trend delta is computed ─────────────────────────────────────────
echo
echo "── Trend delta ──────────────────────────────────────────────────────────"
# First run: 60 KB
make_wasm $(( 60 * 1024 ))
WASM_PATH="$TMP/stellar_save.wasm" WASM_SIZE_LIMIT_KB=100 WARN_THRESHOLD_PCT=80 GIT_SHA=sha1 \
  bash "$(dirname "$0")/../scripts/check_contract_size.sh" &>/dev/null

# Second run: 65 KB (should show positive delta)
make_wasm $(( 65 * 1024 ))
OUT=$(WASM_PATH="$TMP/stellar_save.wasm" WASM_SIZE_LIMIT_KB=100 WARN_THRESHOLD_PCT=80 GIT_SHA=sha2 \
  bash "$(dirname "$0")/../scripts/check_contract_size.sh" 2>&1)
assert_contains "trend shows positive delta" "↑" "$OUT"

# Third run: 55 KB (should show negative delta)
make_wasm $(( 55 * 1024 ))
OUT=$(WASM_PATH="$TMP/stellar_save.wasm" WASM_SIZE_LIMIT_KB=100 WARN_THRESHOLD_PCT=80 GIT_SHA=sha3 \
  bash "$(dirname "$0")/../scripts/check_contract_size.sh" 2>&1)
assert_contains "trend shows negative delta" "↓" "$OUT"

# ─── Test 7: Optimization suggestions appear when large ──────────────────────
echo
echo "── Optimization suggestions ─────────────────────────────────────────────"
make_wasm $(( 85 * 1024 ))
run_check 100 80 &>/dev/null || true
assert_contains "report includes opt suggestions for large WASM" "opt-level" "$(cat "$REPORT")"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Tests: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

[ "$FAIL" -eq 0 ] || exit 1
echo "✅ All size check tests passed."
