#!/usr/bin/env bash
# mobile/scripts/run-tests.sh
#
# Runs all Maestro flows, skipping any listed in quarantine/quarantined_tests.txt.
# Exit code 0 = all non-quarantined tests passed.
# Exit code 1 = one or more non-quarantined tests failed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUARANTINE_FILE="$MOBILE_DIR/quarantine/quarantined_tests.txt"
FLOWS_DIR="$MOBILE_DIR/.maestro"

# Collect quarantined flow paths (ignoring comment lines and blanks)
declare -A QUARANTINED
if [[ -f "$QUARANTINE_FILE" ]]; then
  while IFS= read -r line; do
    # Strip inline comments and leading/trailing whitespace
    clean="${line%%#*}"
    clean="${clean#"${clean%%[![:space:]]*}"}"
    clean="${clean%"${clean##*[![:space:]]}"}"
    if [[ -n "$clean" ]]; then
      QUARANTINED["$MOBILE_DIR/$clean"]=1
    fi
  done < "$QUARANTINE_FILE"
fi

echo "=== Stellar Save Mobile E2E ==="
echo "Flows directory : $FLOWS_DIR"
echo "Quarantined     : ${#QUARANTINED[@]} test(s)"
echo ""

PASS=0
FAIL=0
SKIP=0
FAILED_FLOWS=()

for flow in "$FLOWS_DIR"/*.yaml; do
  # Skip the global config file
  [[ "$(basename "$flow")" == "config.yaml" ]] && continue

  if [[ -n "${QUARANTINED[$flow]+_}" ]]; then
    echo "⏭  SKIPPED (quarantined): $(basename "$flow")"
    SKIP=$((SKIP + 1))
    continue
  fi

  echo "▶  Running: $(basename "$flow")"
  if maestro test "$flow" 2>&1; then
    echo "✅ PASSED: $(basename "$flow")"
    PASS=$((PASS + 1))
  else
    echo "❌ FAILED: $(basename "$flow")"
    FAIL=$((FAIL + 1))
    FAILED_FLOWS+=("$(basename "$flow")")
  fi
  echo ""
done

echo "=== Results ==="
echo "Passed  : $PASS"
echo "Failed  : $FAIL"
echo "Skipped : $SKIP (quarantined)"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failed flows:"
  for f in "${FAILED_FLOWS[@]}"; do
    echo "  - $f"
  done
  echo ""
  echo "To quarantine a flaky test:"
  echo "  echo '.maestro/$f' >> mobile/quarantine/quarantined_tests.txt"
  exit 1
fi

echo ""
echo "All non-quarantined tests passed. ✅"
exit 0
