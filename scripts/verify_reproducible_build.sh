#!/usr/bin/env bash
# scripts/verify_reproducible_build.sh
#
# Full reproducible-build verification pipeline:
#   1. Build the WASM deterministically (inside Docker with pinned Rust toolchain)
#   2. Compare the resulting hash against the committed baseline checksum file
#   3. Optionally compare against the deployed on-chain WASM hash
#
# Usage:
#   ./scripts/verify_reproducible_build.sh [OPTIONS]
#
# Options:
#   --local-only        Skip on-chain hash comparison (no Stellar CLI or network required)
#   --skip-build        Skip Docker build; use existing WASM artifact (must already exist)
#   --regen-checksum    Rebuild and overwrite contracts/stellar-save/stellar_save.wasm.sha256
#   --help              Show this help message
#
# Environment variables (only needed without --local-only):
#   CONTRACT_ID         Deployed contract address on the target network
#   STELLAR_NETWORK     testnet | mainnet  (default: testnet)
#   STELLAR_RPC_URL     Soroban RPC endpoint
#
# Exit codes:
#   0  — all enabled checks passed
#   1  — one or more checks failed (details printed to stdout)
#   2  — usage / configuration error

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACT_DIR="$REPO_ROOT/contracts/stellar-save"
WASM_REL="target/wasm32-unknown-unknown/release/stellar_save.wasm"
WASM_PATH="$REPO_ROOT/$WASM_REL"
CHECKSUM_FILE="$CONTRACT_DIR/stellar_save.wasm.sha256"
RUST_VERSION=$(grep 'channel' "$REPO_ROOT/rust-toolchain.toml" | sed 's/.*"\(.*\)".*/\1/')

# ── Argument parsing ──────────────────────────────────────────────────────────
LOCAL_ONLY=false
SKIP_BUILD=false
REGEN_CHECKSUM=false

for arg in "$@"; do
  case "$arg" in
    --local-only)      LOCAL_ONLY=true ;;
    --skip-build)      SKIP_BUILD=true ;;
    --regen-checksum)  REGEN_CHECKSUM=true ;;
    --help)
      sed -n '/^# Usage/,/^[^#]/p' "$0" | grep '^#' | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Run with --help for usage." >&2
      exit 2
      ;;
  esac
done

# ── Counters & helpers ────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0

ok()   { printf "  ✅  %s\n" "$*"; ((PASS++)) || true; }
fail() { printf "  ❌  %s\n" "$*" >&2; ((FAIL++)) || true; }
skip() { printf "  ⏭   %s\n" "$*"; ((SKIP++)) || true; }
hr()   { printf "\n──────────────────────────────────────────────────────────────\n"; }
section() { printf "\n── %s\n" "$*"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo "============================================================"
echo "  Stellar-Save Reproducible Build Verification"
echo "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "  Rust channel   : $RUST_VERSION"
echo "  Local-only     : $LOCAL_ONLY"
echo "  Skip build     : $SKIP_BUILD"
echo "  Regen checksum : $REGEN_CHECKSUM"
echo "============================================================"

# ── Step 1: Prerequisites ─────────────────────────────────────────────────────
section "Step 1 — Prerequisites"

if ! command -v docker &>/dev/null; then
  fail "Docker is not installed or not on PATH"
  echo "       Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi
ok "Docker found: $(docker --version | head -1)"

if ! command -v sha256sum &>/dev/null; then
  fail "sha256sum is not available"
  exit 1
fi
ok "sha256sum available"

if [ ! -f "$REPO_ROOT/rust-toolchain.toml" ]; then
  fail "rust-toolchain.toml not found at $REPO_ROOT"
  exit 2
fi
ok "rust-toolchain.toml found (channel: $RUST_VERSION)"

# ── Step 2: Docker WASM Build ─────────────────────────────────────────────────
section "Step 2 — WASM Build"

if $SKIP_BUILD; then
  skip "Build skipped (--skip-build)"
  if [ ! -f "$WASM_PATH" ]; then
    fail "No WASM artifact found at $WASM_REL — cannot skip build without prior artifact"
    exit 1
  fi
  ok "Existing WASM artifact found: $WASM_REL"
else
  echo "  Building WASM inside Docker (rust:$RUST_VERSION)…"
  echo "  This may take several minutes on first run (downloads the image)."

  docker run --rm \
    -v "$REPO_ROOT:/workspace" \
    -w /workspace \
    -e SOURCE_DATE_EPOCH=0 \
    -e CARGO_INCREMENTAL=0 \
    -e RUSTFLAGS="-C metadata=00000000 -C extra-filename=" \
    "rust:$RUST_VERSION" \
    bash -c "
      set -euo pipefail
      rustup target add wasm32-unknown-unknown 2>/dev/null
      cargo build \
        --manifest-path contracts/stellar-save/Cargo.toml \
        --target wasm32-unknown-unknown \
        --release
    " 2>&1 | sed 's/^/    | /'

  if [ ! -f "$WASM_PATH" ]; then
    fail "Build finished but WASM artifact not found at $WASM_REL"
    exit 1
  fi
  ok "WASM build complete: $WASM_REL"
fi

# ── Step 3: Compute actual hash ───────────────────────────────────────────────
section "Step 3 — Compute WASM SHA-256"

ACTUAL_HASH=$(sha256sum "$WASM_PATH" | awk '{print $1}')
ok "SHA-256: $ACTUAL_HASH"

# ── Step 4: Checksum file comparison (or regeneration) ───────────────────────
section "Step 4 — Baseline Checksum"

if $REGEN_CHECKSUM; then
  echo "$ACTUAL_HASH" > "$CHECKSUM_FILE"
  ok "Checksum file regenerated: $CHECKSUM_FILE"
  ok "  $ACTUAL_HASH"
else
  if [ ! -f "$CHECKSUM_FILE" ]; then
    fail "Checksum file not found: contracts/stellar-save/stellar_save.wasm.sha256"
    echo "       Run with --regen-checksum to create it from the current build." >&2
    ((FAIL++)) || true
  else
    EXPECTED_HASH=$(cat "$CHECKSUM_FILE")
    echo "  Expected : $EXPECTED_HASH"
    echo "  Actual   : $ACTUAL_HASH"
    if [ "$ACTUAL_HASH" = "$EXPECTED_HASH" ]; then
      ok "WASM hash matches baseline checksum — build is reproducible"
    else
      fail "WASM hash MISMATCH — build is NOT reproducible"
      echo "       Expected : $EXPECTED_HASH" >&2
      echo "       Actual   : $ACTUAL_HASH" >&2
      echo "" >&2
      echo "       Triage steps:" >&2
      echo "         1. Confirm rust-toolchain.toml channel has not changed." >&2
      echo "         2. Check for Cargo.toml dependency version bumps (cargo update)." >&2
      echo "         3. Ensure SOURCE_DATE_EPOCH=0 and CARGO_INCREMENTAL=0 are set." >&2
      echo "         4. Confirm you are using the Docker build, not a native build." >&2
      echo "         5. See docs/reproducible-build-verification.md for full triage guide." >&2
    fi
  fi
fi

# ── Step 5: On-chain hash comparison ─────────────────────────────────────────
section "Step 5 — On-chain Hash Verification"

if $LOCAL_ONLY; then
  skip "On-chain check skipped (--local-only)"
else
  STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
  STELLAR_RPC_URL="${STELLAR_RPC_URL:-}"
  CONTRACT_ID="${CONTRACT_ID:-}"

  if [ -z "$CONTRACT_ID" ]; then
    skip "CONTRACT_ID not set — skipping on-chain hash check"
    echo "       Set CONTRACT_ID env var to enable on-chain verification."
  elif ! command -v stellar &>/dev/null; then
    skip "Stellar CLI not found — skipping on-chain hash check"
    echo "       Install: https://developers.stellar.org/docs/tools/stellar-cli"
  else
    echo "  Querying contract $CONTRACT_ID on $STELLAR_NETWORK…"
    RPC_ARGS=()
    [ -n "$STELLAR_RPC_URL" ] && RPC_ARGS=(--rpc-url "$STELLAR_RPC_URL")

    ONCHAIN_HASH=$(stellar contract info \
      --id "$CONTRACT_ID" \
      --network "$STELLAR_NETWORK" \
      "${RPC_ARGS[@]}" \
      --output json 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('wasm_hash',''))" 2>/dev/null \
      || echo "")

    if [ -z "$ONCHAIN_HASH" ]; then
      fail "Could not retrieve on-chain WASM hash — check CONTRACT_ID and network access"
    else
      echo "  On-chain : $ONCHAIN_HASH"
      echo "  Local    : $ACTUAL_HASH"
      if [ "$ONCHAIN_HASH" = "$ACTUAL_HASH" ]; then
        ok "On-chain WASM hash matches local build — deployed contract is verified"
      else
        fail "On-chain WASM hash MISMATCH — deployed contract may differ from source"
        echo "       This could indicate:" >&2
        echo "         • A different build was deployed (wrong artifact)" >&2
        echo "         • The deployed contract was updated without updating the checksum" >&2
        echo "         • A supply-chain issue (tampering between build and deploy)" >&2
        echo "       See docs/reproducible-build-verification.md § On-chain Mismatch" >&2
      fi
    fi
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
hr
printf "\n  Results:  %d passed,  %d failed,  %d skipped\n" "$PASS" "$FAIL" "$SKIP"
hr

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "🚫  Reproducible-build verification FAILED."
  echo "    See failure messages above and docs/reproducible-build-verification.md"
  exit 1
fi

echo ""
echo "✅  Reproducible-build verification PASSED."
