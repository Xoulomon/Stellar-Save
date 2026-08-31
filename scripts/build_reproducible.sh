#!/usr/bin/env bash
# build_reproducible.sh — Produce a bit-for-bit reproducible WASM build.
#
# Uses a pinned rust Docker image which controls:
#   - Rust toolchain version
#   - Build flags (SOURCE_DATE_EPOCH, CARGO_INCREMENTAL, etc.)
#
# Usage:
#   ./scripts/build_reproducible.sh              # build only (writes checksum)
#   ./scripts/build_reproducible.sh --verify     # build and verify against checksum file
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACT_DIR="contracts/stellar-save"
WASM_OUT="target/wasm32-unknown-unknown/release/stellar_save.wasm"
CHECKSUM_FILE="$CONTRACT_DIR/stellar_save.wasm.sha256"

# Pin the exact Rust toolchain from rust-toolchain.toml so the Docker build
# uses the same version.  Map "stable" → "latest" for the Docker image tag
# (docker.io/library/rust:stable does not exist; use rust:latest instead).
RAW_CHANNEL=$(grep 'channel' "$REPO_ROOT/rust-toolchain.toml" | sed 's/.*"\(.*\)".*/\1/')
if [[ "$RAW_CHANNEL" == "stable" ]]; then
  DOCKER_TAG="latest"
else
  DOCKER_TAG="$RAW_CHANNEL"
fi

echo "==> Reproducible WASM build"
echo "    rust-toolchain channel : $RAW_CHANNEL  (Docker image: rust:$DOCKER_TAG)"
echo "    Contract               : $CONTRACT_DIR"

# Ensure Docker is available
if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is required for reproducible builds." >&2
  exit 1
fi

# Build inside a clean, pinned container.
# The workspace root Cargo.toml includes sibling contracts that may have broken
# dependencies, so we build stellar-save in isolation using a temporary workspace.
# SOURCE_DATE_EPOCH=0 and CARGO_INCREMENTAL=0 are the two main knobs for
# reproducibility.
docker run --rm \
  -v "$REPO_ROOT/contracts/stellar-save:/stellar-save-src:ro" \
  -v "$REPO_ROOT/target:/build-out" \
  -e SOURCE_DATE_EPOCH=0 \
  -e CARGO_INCREMENTAL=0 \
  "rust:$DOCKER_TAG" \
  bash -c "
    set -euo pipefail
    rustup target add wasm32-unknown-unknown

    # Build stellar-save in an isolated workspace to avoid broken sibling contracts
    mkdir -p /build
    cp -r /stellar-save-src/. /build/stellar-save/

    cat > /build/Cargo.toml << 'TOML'
[workspace]
resolver = \"2\"
members = [\"stellar-save\"]

[workspace.package]
version = \"0.1.0\"
edition = \"2021\"
license = \"MIT\"
repository = \"https://github.com/Xoulomon/Stellar-Save\"

[workspace.dependencies]
soroban-sdk = \"23.0.3\"

[profile.release]
opt-level = \"z\"
overflow-checks = true
debug = 0
strip = \"symbols\"
debug-assertions = false
panic = \"abort\"
codegen-units = 1
lto = true
TOML

    cd /build
    cargo build \
      --target wasm32-unknown-unknown \
      --release

    mkdir -p /build-out/wasm32-unknown-unknown/release
    cp /build/target/wasm32-unknown-unknown/release/stellar_save.wasm \
       /build-out/wasm32-unknown-unknown/release/stellar_save.wasm
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
