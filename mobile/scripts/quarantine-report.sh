#!/usr/bin/env bash
# mobile/scripts/quarantine-report.sh
#
# Prints a summary of quarantined tests. Used by CI to post a warning comment.
# Exit code 0 always — quarantined tests are a warning, not a blocker.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUARANTINE_FILE="$SCRIPT_DIR/../quarantine/quarantined_tests.txt"

COUNT=0
ITEMS=()

if [[ -f "$QUARANTINE_FILE" ]]; then
  while IFS= read -r line; do
    clean="${line%%#*}"
    clean="${clean#"${clean%%[![:space:]]*}"}"
    clean="${clean%"${clean##*[![:space:]]}"}"
    if [[ -n "$clean" ]]; then
      COUNT=$((COUNT + 1))
      ITEMS+=("$clean")
    fi
  done < "$QUARANTINE_FILE"
fi

if [[ $COUNT -eq 0 ]]; then
  echo "✅ No quarantined mobile E2E tests."
else
  echo "⚠️  $COUNT quarantined mobile E2E test(s):"
  for item in "${ITEMS[@]}"; do
    echo "   - $item"
  done
  echo ""
  echo "These tests are skipped in CI. Review the quarantine file and fix or remove them."
fi

exit 0
