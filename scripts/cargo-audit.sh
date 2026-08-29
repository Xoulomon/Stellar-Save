#!/usr/bin/env bash
# Run cargo audit locally against the contracts workspace.
# Usage: ./scripts/cargo-audit.sh

set -euo pipefail

echo "=== Cargo Audit — Stellar-Save Contracts ==="

if ! command -v cargo-audit &>/dev/null; then
  echo "Installing cargo-audit..."
  cargo install cargo-audit
fi

echo ""
echo "Scanning dependencies for known vulnerabilities..."
echo ""

cargo audit --deny warnings 2>&1 | tee audit-report.txt

echo ""
echo "Audit complete. Report saved to audit-report.txt"
