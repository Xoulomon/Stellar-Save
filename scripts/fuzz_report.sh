#!/usr/bin/env bash
# scripts/fuzz_report.sh
# Parses cargo test output and generates a Markdown fuzzing report.
# Usage: bash scripts/fuzz_report.sh [output-file]
set -euo pipefail

INPUT="${1:-fuzz-output.txt}"
OUTPUT="fuzz-report.md"

PASSED=0
FAILED=0
IGNORED=0
SHRINK_FAILURES=0
TOTAL_TESTS=0

if [ -f "$INPUT" ]; then
  PASSED=$(grep -c '^test .* \.\.\. ok$' "$INPUT" 2>/dev/null || echo 0)
  FAILED=$(grep -c '^test .* \.\.\. FAILED$' "$INPUT" 2>/dev/null || echo 0)
  IGNORED=$(grep -c '^test .* \.\.\. ignored$' "$INPUT" 2>/dev/null || echo 0)
  SHRINK_FAILURES=$(grep -c 'minimal failing input' "$INPUT" 2>/dev/null || echo 0)
  TOTAL_TESTS=$((PASSED + FAILED + IGNORED))
fi

CASES="${PROPTEST_CASES:-256}"
STATUS="✅ Passed"
[ "$FAILED" -gt 0 ] && STATUS="❌ Failed"

cat > "$OUTPUT" <<EOF
| Metric | Value |
|--------|-------|
| Status | ${STATUS} |
| Tests run | ${TOTAL_TESTS} |
| Passed | ${PASSED} |
| Failed | ${FAILED} |
| Ignored | ${IGNORED} |
| Cases per test | ${CASES} |
| Shrunk failures | ${SHRINK_FAILURES} |
| Commit | \`${GITHUB_SHA:-local}\` |
| Run at | $(date -u +%Y-%m-%dT%H:%M:%SZ) |

### Properties tested

- \`prop_contribution_amount_stored_exactly\` — amount/cycle/group_id stored without mutation
- \`prop_contribution_rejects_non_positive_amount\` — zero/negative amounts always panic
- \`prop_contribution_sum_no_overflow\` — summing valid amounts never overflows i128
- \`prop_terminal_states_reject_all_transitions\` — Completed/Cancelled block all transitions
- \`prop_pending_valid_transitions\` — Pending cannot skip to Paused/Completed
- \`prop_active_valid_transitions\` — Active can reach Paused/Completed/Cancelled
- \`prop_paused_cannot_complete_directly\` — Paused cannot jump to Completed
- \`prop_config_invalid_when_min_exceeds_max_contribution\` — min > max fails validation
- \`prop_config_invalid_when_min_members_below_2\` — min_members < 2 fails validation
- \`prop_valid_config_passes_validation\` — well-formed config always passes
- \`prop_config_invalid_zero_min_contribution\` — zero min_contribution fails validation
- \`prop_payout_position_in_bounds\` — payout position bounds invariant
- \`prop_total_payout_equals_total_contributions\` — pool arithmetic consistency
- \`prop_cycle_within_group_lifetime\` — cycle number lifecycle invariant
EOF

echo "Fuzzing report written to ${OUTPUT}"
cat "$OUTPUT"

[ "$FAILED" -eq 0 ]
