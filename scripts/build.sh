#!/bin/bash
set -e

echo "Building Stellar contracts..."
cd "$(dirname "$0")/.."

cargo build --release --target wasm32-unknown-unknown --workspace

echo "✓ Build complete"
