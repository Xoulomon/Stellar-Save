#!/usr/bin/env bash
# mobile/scripts/run-tests.sh
#
# Runs all Maestro flows, skipping any listed in quarantine/quarantined_tests.txt.
# Exit code 0 = all non-quarantined tests passed.
# Exit code 1 = one or more non-quarantined tests failed.
#
# Usage:
#   ./run-tests.sh                  # single pass (default, used in CI)
#   ./run-tests.sh --repeat 10      # run each flow N times for stability validation
#
# The --repeat flag is intended for local pre-merge stability checks.
# All N iterations of a flow must pass for the flow to be considered stable.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUARANTINE_FILE="$MOBILE_DIR/quarantine/quarantined_tests.txt"
FLOWS_DIR="$MOBILE_DIR/.maestro"
REPEAT=1

# Parse CLI flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repeat)
      REPEAT="${2:?--repeat requires a count argument}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

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
echo "Repeat          : ${REPEAT}x per flow"
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

  flow_failed=0
  for ((i = 1; i <= REPEAT; i++)); do
    if [[ $REPEAT -gt 1 ]]; then
      echo "▶  Running: $(basename "$flow") [run $i/$REPEAT]"
    else
      echo "▶  Running: $(basename "$flow")"
    fi

    if maestro test "$flow" 2>&1; then
      echo "✅ PASSED: $(basename "$flow") [run $i/$REPEAT]"
    else
      echo "❌ FAILED: $(basename "$flow") [run $i/$REPEAT]"
      flow_failed=1
      # Stop repeating this flow on first failure to surface the issue early
      break
    fi
  done

  if [[ $flow_failed -eq 0 ]]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    FAILED_FLOWS+=("$(basename "$flow")")
  fi
  echo ""
done

echo "=== Results ==="
echo "Passed  : $PASS"
echo "Failed  : $FAIL"
echo "Skipped : $SKIP (quarantined)"
if [[ $REPEAT -gt 1 ]]; then
  echo "Note    : each flow ran up to ${REPEAT}x — all runs must pass"
fi

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
