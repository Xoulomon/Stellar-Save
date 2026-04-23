#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Running smoke tests..."

# Contract smoke tests (runs a subset of contract tests that are deterministic)
cargo test --manifest-path contracts/stellar-save/Cargo.toml -- --test-threads=1

# Frontend smoke tests
npm --prefix frontend run test -- --run --pool=threads

echo "✓ Smoke tests passed"
