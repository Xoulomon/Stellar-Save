<<<<<<< HEAD
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Running contract tests..."
cargo test --workspace --lib

echo ""
echo "Running frontend tests..."
cd frontend
npm test run

echo ""
echo "✓ All tests passed"
=======
#!/usr/bin/env bash
set -euo pipefail

# Run the stellar-save test suite.

cargo test \
  --manifest-path contracts/stellar-save/Cargo.toml \
  -- --nocapture "$@"
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
