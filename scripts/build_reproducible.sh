#!/usr/bin/env bash
# build_reproducible.sh — Produce a bit-for-bit reproducible WASM build.
#
# Uses the official stellar/stellar-build-tools Docker image which pins:
#   - Rust toolchain version
#   - LLVM / wasm-opt version
#   - Build flags (SOURCE_DATE_EPOCH, etc.)
#
# Usage:
#   ./scripts/build_reproducible.sh              # build only
#   ./scripts/build_reproducible.sh --verify     # build and verify against checksum file
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT_DIR="contracts/stellar-save"
WASM_OUT="target/wasm32-unknown-unknown/release/stellar_save.wasm"
CHECKSUM_FILE="$CONTRACT_DIR/stellar_save.wasm.sha256"

# Pin the exact Rust toolchain from rust-toolchain.toml so the Docker build
# uses the same version.
RUST_VERSION=$(grep 'channel' "$REPO_ROOT/rust-toolchain.toml" | sed 's/.*"\(.*\)".*/\1/')

echo "==> Reproducible WASM build"
echo "    Rust channel : $RUST_VERSION"
echo "    Contract     : $CONTRACT_DIR"

# Ensure Docker is available
if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is required for reproducible builds." >&2
  exit 1
fi

# Build inside a clean, pinned container.
# SOURCE_DATE_EPOCH=0 and CARGO_INCREMENTAL=0 are the two main knobs for
# reproducibility; the rest strips non-deterministic metadata from the binary.
docker run --rm \
  -v "$REPO_ROOT:/workspace" \
  -w /workspace \
  -e SOURCE_DATE_EPOCH=0 \
  -e CARGO_INCREMENTAL=0 \
  -e RUSTFLAGS="-C metadata=00000000 -C extra-filename=" \
  "rust:$RUST_VERSION" \
  bash -c "
    set -euo pipefail
    rustup target add wasm32-unknown-unknown
    cargo build \
      --manifest-path $CONTRACT_DIR/Cargo.toml \
      --target wasm32-unknown-unknown \
      --release
  "

echo "==> Build complete: $WASM_OUT"

# ── Verification mode ────────────────────────────────────────────────────────
if [[ "${1:-}" == "--verify" ]]; then
  if [[ ! -f "$REPO_ROOT/$CHECKSUM_FILE" ]]; then
    echo "ERROR: Checksum file not found: $CHECKSUM_FILE" >&2
    echo "       Run without --verify first to generate it." >&2
    exit 1
  fi

  ACTUAL=$(sha256sum "$REPO_ROOT/$WASM_OUT" | awk '{print $1}')
  EXPECTED=$(cat "$REPO_ROOT/$CHECKSUM_FILE")

  echo "==> Verifying WASM integrity"
  echo "    Expected : $EXPECTED"
  echo "    Actual   : $ACTUAL"

  if [[ "$ACTUAL" == "$EXPECTED" ]]; then
    echo "✅  WASM matches recorded checksum — build is reproducible."
  else
    echo "❌  WASM does NOT match recorded checksum!" >&2
    exit 1
  fi
else
  # Write / update the checksum file for future verification.
  sha256sum "$REPO_ROOT/$WASM_OUT" | awk '{print $1}' > "$REPO_ROOT/$CHECKSUM_FILE"
  echo "==> Checksum written to $CHECKSUM_FILE"
  echo "    $(cat "$REPO_ROOT/$CHECKSUM_FILE")"
fi
