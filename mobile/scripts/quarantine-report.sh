#!/usr/bin/env bash
# mobile/scripts/quarantine-report.sh
#
# Prints a summary of quarantined tests. Used by CI to post a warning comment.
# Exit code 0 always — quarantined tests are a warning, not a blocker.
#
# Issue #1912: a quarantine with no owner and no return date rots silently.
# Each active entry's comment is expected to carry `owner:` and `expires:`
# fields (see the file's own header for the exact format); this report flags
# entries missing either, and separately flags entries past their expiry
# date, so a stale quarantine shows up somewhere instead of just aging out
# of anyone's attention.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUARANTINE_FILE="$SCRIPT_DIR/../quarantine/quarantined_tests.txt"

COUNT=0
ITEMS=()
UNOWNED=()
EXPIRED=()
TODAY="$(date +%Y-%m-%d)"

if [[ -f "$QUARANTINE_FILE" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    clean="${line%%#*}"
    clean="${clean#"${clean%%[![:space:]]*}"}"
    clean="${clean%"${clean##*[![:space:]]}"}"
    if [[ -n "$clean" ]]; then
      COUNT=$((COUNT + 1))
      ITEMS+=("$line")

      if [[ "$line" != *"owner:"* || "$line" != *"expires:"* ]]; then
        UNOWNED+=("$clean")
      elif [[ "$line" =~ expires:[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
        expires="${BASH_REMATCH[1]}"
        if [[ "$expires" < "$TODAY" ]]; then
          EXPIRED+=("$clean (expired $expires)")
        fi
      fi
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

  if [[ ${#UNOWNED[@]} -gt 0 ]]; then
    echo ""
    echo "🚫 Missing owner/expires metadata (fix the entry's comment):"
    for item in "${UNOWNED[@]}"; do
      echo "   - $item"
    done
  fi

  if [[ ${#EXPIRED[@]} -gt 0 ]]; then
    echo ""
    echo "⏰ Past their expiry date — re-triage into fix/rewrite/delete:"
    for item in "${EXPIRED[@]}"; do
      echo "   - $item"
    done
  fi
fi

exit 0
