#!/usr/bin/env bash
# scripts/size_check_ci.sh
#
# Lightweight CI size gate for the Stellar-Save Soroban contract.
#
# Unlike the full scripts/check_contract_size.sh (which tracks history and
# generates markdown reports), this script is designed for fast CI feedback:
# - Builds the WASM if it does not already exist
# - Measures size in bytes
# - Exits 0 (pass) or 1 (fail) with a one-line summary
# - Emits a GitHub Actions warning annotation when size crosses WARN_THRESHOLD_KB
#
# Usage:
#   bash scripts/size_check_ci.sh
#
# Optional environment variables:
#   WASM_PATH           Path to the compiled WASM (default: auto-detected)
#   SIZE_LIMIT_KB       Hard failure threshold in KB (default: 100)
#   WARN_THRESHOLD_KB   Soft warning threshold in KB (default: 80)
#   SKIP_BUILD          Set to "1" to skip the build step (default: unset)
#
# Exit codes:
#   0  WASM is within the hard limit
#   1  WASM exceeds the hard limit, or WASM file was not found after build
#
# Soroban enforces a 100 KB limit on-chain. Any contract that exceeds this
# limit cannot be deployed and CI must block the merge immediately.
# See docs/size-optimization.md for optimization techniques.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WASM_PATH="${WASM_PATH:-$ROOT/target/wasm32-unknown-unknown/release/stellar_save.wasm}"
SIZE_LIMIT_KB="${SIZE_LIMIT_KB:-100}"
WARN_THRESHOLD_KB="${WARN_THRESHOLD_KB:-80}"
SKIP_BUILD="${SKIP_BUILD:-0}"

SIZE_LIMIT_BYTES=$(( SIZE_LIMIT_KB * 1024 ))
WARN_THRESHOLD_BYTES=$(( WARN_THRESHOLD_KB * 1024 ))

# ── Build ─────────────────────────────────────────────────────────────────────

if [[ "$SKIP_BUILD" != "1" && ! -f "$WASM_PATH" ]]; then
  echo "🔨 WASM not found — building release target..."
  cargo build \
    --manifest-path "$ROOT/contracts/stellar-save/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release \
    --quiet
fi

if [[ ! -f "$WASM_PATH" ]]; then
  echo "❌ WASM file not found: $WASM_PATH" >&2
  echo "   Run: cargo build --manifest-path contracts/stellar-save/Cargo.toml --target wasm32-unknown-unknown --release" >&2
  exit 1
fi

# ── Measure ───────────────────────────────────────────────────────────────────

SIZE_BYTES=$(wc -c < "$WASM_PATH")
SIZE_KB=$(( (SIZE_BYTES + 1023) / 1024 ))   # ceiling division

# ── Emit GitHub Actions annotations when running in CI ───────────────────────

if [[ "${CI:-false}" == "true" || "${GITHUB_ACTIONS:-false}" == "true" ]]; then
  if (( SIZE_BYTES > SIZE_LIMIT_BYTES )); then
    echo "::error file=contracts/stellar-save/Cargo.toml::WASM size ${SIZE_KB} KB exceeds Soroban ${SIZE_LIMIT_KB} KB limit. See docs/size-optimization.md."
  elif (( SIZE_BYTES > WARN_THRESHOLD_BYTES )); then
    echo "::warning file=contracts/stellar-save/Cargo.toml::WASM size ${SIZE_KB} KB is above the ${WARN_THRESHOLD_KB} KB warning threshold (limit: ${SIZE_LIMIT_KB} KB)."
  fi
fi

# ── Report ────────────────────────────────────────────────────────────────────

HEADROOM_KB=$(( SIZE_LIMIT_KB - SIZE_KB ))
USED_PCT_INT=$(( SIZE_BYTES * 100 / SIZE_LIMIT_BYTES ))

if (( SIZE_BYTES > SIZE_LIMIT_BYTES )); then
  STATUS_ICON="🚨"
  STATUS_TEXT="FAIL — exceeds ${SIZE_LIMIT_KB} KB Soroban limit"
elif (( SIZE_BYTES > WARN_THRESHOLD_BYTES )); then
  STATUS_ICON="⚠️ "
  STATUS_TEXT="WARN — above ${WARN_THRESHOLD_KB} KB warning threshold"
else
  STATUS_ICON="✅"
  STATUS_TEXT="PASS"
fi

echo ""
echo "${STATUS_ICON} Contract size: ${SIZE_KB} KB (${SIZE_BYTES} bytes) — ${USED_PCT_INT}% of ${SIZE_LIMIT_KB} KB limit"
echo "   Headroom : ${HEADROOM_KB} KB"
echo "   Status   : ${STATUS_TEXT}"
echo "   WASM     : ${WASM_PATH}"
echo ""

# ── Gate ──────────────────────────────────────────────────────────────────────

if (( SIZE_BYTES > SIZE_LIMIT_BYTES )); then
  echo "🚫 CI blocked: contract exceeds Soroban ${SIZE_LIMIT_KB} KB on-chain limit."
  echo "   See docs/size-optimization.md for techniques to reduce WASM size."
  echo ""
  echo "   Quick wins:"
  echo "     • Verify [profile.release] in Cargo.toml has opt-level=\"z\", lto=true"
  echo "     • Run: wasm-opt -Oz <output.wasm> -o <output.wasm>"
  echo "     • Remove unused features from soroban-sdk dependency"
  exit 1
fi

exit 0
