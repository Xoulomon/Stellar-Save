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
