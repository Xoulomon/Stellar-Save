#!/usr/bin/env bash
# Scan the apps and shared packages for unused exports using ts-prune.
#
# Usage: ./scripts/find-unused-exports.sh
#
# Prerequisites:
#   pnpm add -Dw ts-prune
#
# For packages/* a package's public API is its src/index.ts. Anything a
# package exports must be imported by an app (frontend, backend, mobile);
# grep for "@stellar-save/<name>" to confirm before keeping an export.
# Exports marked `@internal` exist only for co-located unit tests and are
# not re-exported from index.ts.

set -euo pipefail

echo "=== Unused Export Scanner — Stellar-Save ==="
echo ""

if ! command -v ts-prune &>/dev/null && ! npx ts-prune --help &>/dev/null 2>&1; then
  echo "Error: ts-prune not found. Install with: pnpm add -Dw ts-prune"
  exit 1
fi

scan() {
  local label="$1" project="$2"
  echo "--- ${label} ---"
  npx ts-prune --project "${project}" 2>/dev/null | grep -v '(used in module)' || echo "No unused exports found"
  echo ""
}

scan "Frontend (frontend/src)" frontend/tsconfig.json
scan "Backend (backend/src)" backend/tsconfig.json
scan "SDK (packages/sdk)" packages/sdk/tsconfig.json
scan "Shared utils (packages/shared-utils)" packages/shared-utils/tsconfig.json

echo "--- Package consumers ---"
for pkg in sdk shared-utils events-schema; do
  echo "@stellar-save/${pkg}:"
  # events-schema is imported by relative path, the others by package name.
  grep -rhoE "(import|export)[^;]*from '([^']*/packages/${pkg}/[^']*|@stellar-save/${pkg})'" \
    --include='*.ts' --include='*.tsx' frontend/src backend/src mobile/src 2>/dev/null \
    | sort -u || echo "  (no consumers)"
done
echo ""
echo "Note: packages/events-schema/generated/events.ts is emitted by codegen.js"
echo "from schema.json; every event interface is part of the ContractEvent union"
echo "and is kept even when no app names it directly."
echo ""
echo "Done. Review the output above and remove confirmed-unused exports."
