<<<<<<< HEAD
#!/bin/bash
set -e

echo "Building Stellar contracts..."
cd "$(dirname "$0")/.."

cargo build --release --target wasm32-unknown-unknown --workspace

echo "✓ Build complete"
=======
#!/usr/bin/env bash
set -euo pipefail

# Build the stellar-save ROSCA contract to WASM.

cargo build \
  --manifest-path contracts/stellar-save/Cargo.toml \
  --target wasm32-unknown-unknown \
  --release

WASM="target/wasm32-unknown-unknown/release/stellar_save.wasm"
echo "✅ Build complete: $WASM"
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
