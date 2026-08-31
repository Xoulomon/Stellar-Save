#!/usr/bin/env bash
# Scan frontend and backend for unused exports using ts-prune.
#
# Usage: ./scripts/find-unused-exports.sh
#
# Prerequisites:
#   pnpm add -Dw ts-prune

set -euo pipefail

echo "=== Unused Export Scanner — Stellar-Save ==="
echo ""

if ! command -v ts-prune &>/dev/null && ! npx ts-prune --help &>/dev/null 2>&1; then
  echo "Error: ts-prune not found. Install with: pnpm add -Dw ts-prune"
  exit 1
fi

echo "--- Frontend (frontend/src) ---"
npx ts-prune --project frontend/tsconfig.json 2>/dev/null | grep -v '(used in module)' || echo "No unused exports found"

echo ""
echo "--- Backend (backend/src) ---"
npx ts-prune --project backend/tsconfig.json 2>/dev/null | grep -v '(used in module)' || echo "No unused exports found"

echo ""
echo "Done. Review the output above and remove confirmed-unused exports."
echo "Re-export intentionally-public API explicitly to avoid false positives."
