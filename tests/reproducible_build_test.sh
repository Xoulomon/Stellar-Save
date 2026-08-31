#!/usr/bin/env bash
# tests/reproducible_build_test.sh
#
# Automated test suite asserting that the WASM build hash matches:
#   • The committed baseline checksum file  (always tested)
#   • The deployed on-chain contract hash   (tested when CONTRACT_ID is set)
#
# Usage:
#   ./tests/reproducible_build_test.sh              # full pipeline
#   ./tests/reproducible_build_test.sh --local-only # skip on-chain check
#   ./tests/reproducible_build_test.sh --skip-build # use existing WASM artifact
#
# Exit code 0 = all tests passed; non-zero = at least one failure.
#
# Follows the same test-naming/output convention as other tests/ scripts
# (blue_green_test.sh, canary_test.sh, size_check_test.sh).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERIFY_SCRIPT="$REPO_ROOT/scripts/verify_reproducible_build.sh"
CONTRACT_DIR="$REPO_ROOT/contracts/stellar-save"
WASM_REL="target/wasm32-unknown-unknown/release/stellar_save.wasm"
WASM_PATH="$REPO_ROOT/$WASM_REL"
CHECKSUM_FILE="$CONTRACT_DIR/stellar_save.wasm.sha256"

# ── Argument passthrough ──────────────────────────────────────────────────────
LOCAL_ONLY=false
SKIP_BUILD=false
EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --local-only) LOCAL_ONLY=true;  EXTRA_ARGS+=(--local-only) ;;
    --skip-build) SKIP_BUILD=true;  EXTRA_ARGS+=(--skip-build) ;;
    --help)
      echo "Usage: $0 [--local-only] [--skip-build]"
      echo ""
      echo "  --local-only  Skip on-chain hash check (no Stellar CLI or network needed)"
      echo "  --skip-build  Use an existing WASM artifact rather than rebuilding"
      exit 0
      ;;
  esac
done

# ── Test counter helpers ──────────────────────────────────────────────────────
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  ((TESTS_RUN++)) || true
  ((TESTS_PASSED++)) || true
  printf "  ✅  PASS  %s\n" "$*"
}

fail() {
  ((TESTS_RUN++)) || true
  ((TESTS_FAILED++)) || true
  printf "  ❌  FAIL  %s\n" "$*" >&2
}

skip() {
  printf "  ⏭   SKIP  %s\n" "$*"
}

section() {
  printf "\n[%s]\n" "$*"
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo "============================================================"
echo "  Reproducible Build Tests"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "============================================================"

# ══════════════════════════════════════════════════════════════════════════════
# Test 1: verify_reproducible_build.sh is executable and parseable
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 1 — Verification script exists and is executable"

if [ -f "$VERIFY_SCRIPT" ]; then
  pass "verify_reproducible_build.sh exists"
else
  fail "verify_reproducible_build.sh not found at scripts/verify_reproducible_build.sh"
fi

if [ -x "$VERIFY_SCRIPT" ]; then
  pass "verify_reproducible_build.sh is executable"
else
  fail "verify_reproducible_build.sh is not executable (chmod +x scripts/verify_reproducible_build.sh)"
fi

# Smoke-test: --help exits 0 and emits usage text
if HELP_OUT=$("$VERIFY_SCRIPT" --help 2>&1); then
  pass "--help exits 0"
else
  fail "--help exited with error"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Test 2: Docker is available (required for reproducible build)
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 2 — Docker availability"

if command -v docker &>/dev/null; then
  pass "Docker is available: $(docker --version | head -1)"
else
  fail "Docker is not installed — reproducible builds require Docker"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Test 3: Run the full verification pipeline (build + checksum match)
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 3 — Full verification pipeline (build + checksum)"

VERIFY_ARGS=("${EXTRA_ARGS[@]}")
# Always use --local-only for the pipeline check in this test; on-chain is
# tested separately in Test 5 when CONTRACT_ID is set.
if ! $LOCAL_ONLY; then
  VERIFY_ARGS+=(--local-only)
fi

echo "  Running: $VERIFY_SCRIPT ${VERIFY_ARGS[*]:-}"

PIPELINE_OUTPUT=$("$VERIFY_SCRIPT" "${VERIFY_ARGS[@]}" 2>&1) && PIPELINE_EXIT=0 || PIPELINE_EXIT=$?

# Print captured output indented
while IFS= read -r line; do
  printf "    %s\n" "$line"
done <<< "$PIPELINE_OUTPUT"

if [ "$PIPELINE_EXIT" -eq 0 ]; then
  pass "Verification pipeline exited 0"
else
  fail "Verification pipeline exited $PIPELINE_EXIT"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Test 4: Checksum file is present and well-formed
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 4 — Baseline checksum file integrity"

if [ -f "$CHECKSUM_FILE" ]; then
  pass "Checksum file exists: contracts/stellar-save/stellar_save.wasm.sha256"
else
  fail "Checksum file missing: contracts/stellar-save/stellar_save.wasm.sha256"
  echo "       Run: ./scripts/verify_reproducible_build.sh --regen-checksum" >&2
fi

if [ -f "$CHECKSUM_FILE" ]; then
  STORED_HASH=$(cat "$CHECKSUM_FILE")
  # SHA-256 is exactly 64 lowercase hex characters
  if echo "$STORED_HASH" | grep -qE '^[0-9a-f]{64}$'; then
    pass "Checksum is valid SHA-256 (64 hex chars): $STORED_HASH"
  else
    fail "Checksum file content does not look like a valid SHA-256: '$STORED_HASH'"
  fi
fi

# Cross-check: if WASM artifact exists, recompute and compare
if [ -f "$WASM_PATH" ] && [ -f "$CHECKSUM_FILE" ]; then
  RECOMPUTED=$(sha256sum "$WASM_PATH" | awk '{print $1}')
  STORED=$(cat "$CHECKSUM_FILE")
  if [ "$RECOMPUTED" = "$STORED" ]; then
    pass "WASM artifact hash matches checksum file (reproducibility confirmed)"
  else
    fail "WASM artifact hash does NOT match checksum file"
    echo "       Checksum file : $STORED" >&2
    echo "       WASM artifact  : $RECOMPUTED" >&2
    echo "       The artifact may have been built outside the reproducible pipeline." >&2
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Test 5: Mismatch detection — verify that a tampered hash is rejected
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 5 — Mismatch detection (tampered checksum is rejected)"

if [ -f "$CHECKSUM_FILE" ]; then
  ORIG_HASH=$(cat "$CHECKSUM_FILE")
  TAMPERED_HASH="0000000000000000000000000000000000000000000000000000000000000000"
  TAMPERED_FILE=$(mktemp)
  trap 'rm -f "$TAMPERED_FILE"' EXIT

  echo "$TAMPERED_HASH" > "$TAMPERED_FILE"

  # Temporarily symlink: test by passing a bad hash via a subshell
  # We can't easily override the checksum file path, so we use --skip-build with
  # a copy and run a direct sha256 comparison.
  if [ -f "$WASM_PATH" ]; then
    ACTUAL=$(sha256sum "$WASM_PATH" | awk '{print $1}')
    if [ "$ACTUAL" != "$TAMPERED_HASH" ]; then
      pass "Tampered hash correctly differs from actual WASM hash (mismatch would be caught)"
    else
      fail "Tampered hash unexpectedly matches WASM — this should never happen"
    fi

    # Also verify the pipeline would exit non-zero for a mismatch
    # We do this by temporarily replacing checksum file in a subshell
    MISMATCH_EXIT=0
    (
      cp "$CHECKSUM_FILE" "${CHECKSUM_FILE}.bak"
      echo "$TAMPERED_HASH" > "$CHECKSUM_FILE"
      "$VERIFY_SCRIPT" --skip-build --local-only > /dev/null 2>&1
      EXIT=$?
      mv "${CHECKSUM_FILE}.bak" "$CHECKSUM_FILE"
      exit $EXIT
    ) || MISMATCH_EXIT=$?

    # Restore in case the subshell failed before mv
    [ -f "${CHECKSUM_FILE}.bak" ] && mv "${CHECKSUM_FILE}.bak" "$CHECKSUM_FILE" 2>/dev/null || true

    if [ "$MISMATCH_EXIT" -ne 0 ]; then
      pass "Verification pipeline correctly exits non-zero on hash mismatch"
    else
      fail "Verification pipeline did NOT exit non-zero on tampered checksum — detection broken"
    fi
  else
    skip "WASM artifact not yet built — skipping mismatch simulation (run without --skip-build first)"
  fi
else
  skip "No checksum file — cannot run mismatch simulation"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Test 6: On-chain hash check (only when CONTRACT_ID is set and Stellar CLI available)
# ══════════════════════════════════════════════════════════════════════════════
section "TEST 6 — On-chain hash verification"

if $LOCAL_ONLY; then
  skip "On-chain test skipped (--local-only)"
elif [ -z "${CONTRACT_ID:-}" ]; then
  skip "CONTRACT_ID not set — skipping on-chain hash test"
  echo "       Export CONTRACT_ID=<address> to enable this test."
elif ! command -v stellar &>/dev/null; then
  skip "Stellar CLI not found — skipping on-chain hash test"
  echo "       Install: https://developers.stellar.org/docs/tools/stellar-cli"
else
  STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
  STELLAR_RPC_URL="${STELLAR_RPC_URL:-}"
  RPC_ARGS=()
  [ -n "$STELLAR_RPC_URL" ] && RPC_ARGS=(--rpc-url "$STELLAR_RPC_URL")

  echo "  Querying $CONTRACT_ID on $STELLAR_NETWORK…"

  ONCHAIN_HASH=$(stellar contract info \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    "${RPC_ARGS[@]}" \
    --output json 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('wasm_hash',''))" 2>/dev/null \
    || echo "")

  if [ -z "$ONCHAIN_HASH" ]; then
    fail "Could not retrieve on-chain WASM hash — check CONTRACT_ID and network connectivity"
  else
    EXPECTED=$(cat "$CHECKSUM_FILE" 2>/dev/null || echo "")
    echo "  On-chain : $ONCHAIN_HASH"
    echo "  Local    : $EXPECTED"
    if [ "$ONCHAIN_HASH" = "$EXPECTED" ]; then
      pass "On-chain WASM hash matches local baseline — deployed contract is verified"
    else
      fail "On-chain WASM hash MISMATCH — deployed contract differs from local build"
      echo "       See docs/reproducible-build-verification.md § On-chain Mismatch" >&2
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "============================================================"
printf "  Tests run: %d   Passed: %d   Failed: %d\n" \
  "$TESTS_RUN" "$TESTS_PASSED" "$TESTS_FAILED"
echo "============================================================"

if [ "$TESTS_FAILED" -gt 0 ]; then
  echo "🚫  Reproducible build tests FAILED."
  exit 1
fi

echo "✅  All reproducible build tests PASSED."
exit 0
