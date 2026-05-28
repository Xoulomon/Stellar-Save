#!/usr/bin/env bash
# scripts/cost_optimization.sh
# Analyse CI/CD patterns and print actionable cost-saving recommendations.
# Exit 0 always — recommendations are advisory, not blocking.
set -euo pipefail

WARN="\033[33m⚠ \033[0m"
OK="\033[32m✓ \033[0m"
TIP="\033[36m💡\033[0m"

echo "=== Stellar-Save Cost Optimization Report ==="
echo "Generated: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

# ── 1. Workflow run durations ─────────────────────────────────────────────────
echo "--- CI Workflow Analysis ---"

if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  # Fetch last 20 runs for each workflow and flag slow ones
  WORKFLOWS=$(gh api /repos/"${GITHUB_REPOSITORY:-$(git remote get-url origin | sed 's|.*github.com/||;s|\.git$||')}"/actions/workflows \
    --jq '.workflows[].name' 2>/dev/null || true)

  if [ -n "$WORKFLOWS" ]; then
    while IFS= read -r wf; do
      AVG=$(gh api "/repos/${GITHUB_REPOSITORY}/actions/runs?per_page=10" \
        --jq "[.workflow_runs[] | select(.name==\"$wf\") | .run_duration_ms // 0] | add / length / 60000" \
        2>/dev/null || echo "0")
      AVG_INT=${AVG%.*}
      if [ "${AVG_INT:-0}" -gt 15 ]; then
        echo -e "${WARN}Workflow '$wf' averages ~${AVG_INT} min. Consider:"
        echo -e "  ${TIP} Split into smaller parallel jobs"
        echo -e "  ${TIP} Cache dependencies (actions/cache)"
        echo -e "  ${TIP} Use path filters to skip unchanged components"
      else
        echo -e "${OK}Workflow '$wf' averages ~${AVG_INT} min — OK"
      fi
    done <<< "$WORKFLOWS"
  else
    echo "  (No workflow data available — skipping)"
  fi
else
  echo "  (gh CLI not authenticated — skipping live workflow analysis)"
fi

echo ""

# ── 2. Artifact retention ─────────────────────────────────────────────────────
echo "--- Artifact Retention ---"
RETENTION_DAYS=$(grep -r 'retention-days:' .github/workflows/ 2>/dev/null | \
  grep -oP 'retention-days:\s*\K\d+' | sort -n | tail -1 || echo "90")

if [ "${RETENTION_DAYS:-90}" -gt 30 ]; then
  echo -e "${WARN}Longest artifact retention: ${RETENTION_DAYS} days"
  echo -e "  ${TIP} Reduce to 7-14 days for coverage/test reports to save storage"
  echo -e "  ${TIP} Keep deployment artifacts for 30 days max"
else
  echo -e "${OK}Artifact retention ≤ 30 days — OK"
fi

echo ""

# ── 3. Duplicate job detection ────────────────────────────────────────────────
echo "--- Duplicate Work Detection ---"
SETUP_NODE_COUNT=$(grep -r 'actions/setup-node' .github/workflows/ 2>/dev/null | wc -l || echo 0)
RUST_TOOLCHAIN_COUNT=$(grep -r 'dtolnay/rust-toolchain\|actions/setup-rust' .github/workflows/ 2>/dev/null | wc -l || echo 0)

if [ "${SETUP_NODE_COUNT//[[:space:]]/}" -gt 4 ]; then
  echo -e "${WARN}Node.js setup appears ${SETUP_NODE_COUNT}x across workflows"
  echo -e "  ${TIP} Use a reusable workflow (.github/workflows/setup-node.yml) to deduplicate"
else
  echo -e "${OK}Node.js setup count (${SETUP_NODE_COUNT}) — OK"
fi

if [ "${RUST_TOOLCHAIN_COUNT//[[:space:]]/}" -gt 3 ]; then
  echo -e "${WARN}Rust toolchain setup appears ${RUST_TOOLCHAIN_COUNT}x across workflows"
  echo -e "  ${TIP} Use Swatinem/rust-cache consistently and share a reusable job"
else
  echo -e "${OK}Rust toolchain setup count (${RUST_TOOLCHAIN_COUNT}) — OK"
fi

echo ""

# ── 4. Concurrency / cancel-in-progress ──────────────────────────────────────
echo "--- Concurrency Settings ---"
CONCURRENCY_COUNT=$(grep -r 'cancel-in-progress: true' .github/workflows/ 2>/dev/null | wc -l || echo 0)
WORKFLOW_COUNT=$(find .github/workflows/ -name '*.yml' 2>/dev/null | wc -l || echo 0)

if [ "${CONCURRENCY_COUNT//[[:space:]]/}" -lt "${WORKFLOW_COUNT//[[:space:]]/}" ]; then
  MISSING=$((${WORKFLOW_COUNT//[[:space:]]/} - ${CONCURRENCY_COUNT//[[:space:]]/}))
  echo -e "${WARN}${MISSING} workflow(s) lack 'cancel-in-progress: true'"
  echo -e "  ${TIP} Add to each workflow to cancel superseded runs on new pushes:"
  echo -e "       concurrency:"
  echo -e "         group: \${{ github.workflow }}-\${{ github.ref }}"
  echo -e "         cancel-in-progress: true"
else
  echo -e "${OK}All workflows have cancel-in-progress — OK"
fi

echo ""

# ── 5. Storage cleanup ────────────────────────────────────────────────────────
echo "--- Local Storage ---"
if [ -d "backend" ]; then
  EXPORT_SIZE=$(du -sh backend/exports 2>/dev/null | cut -f1 || echo "0")
  BACKUP_SIZE=$(du -sh backend/backups 2>/dev/null | cut -f1 || echo "0")
  echo "  Export directory: ${EXPORT_SIZE}"
  echo "  Backup directory: ${BACKUP_SIZE}"

  OLD_EXPORTS=0
  if [ -d "backend/exports" ]; then
    OLD_EXPORTS=$(find backend/exports -maxdepth 1 \( -name '*.json' -o -name '*.csv' \) -printf '%T@ %p\n' 2>/dev/null | \
      sort -rn | tail -n +11 | wc -l | tr -d '[:space:]')
    OLD_EXPORTS=${OLD_EXPORTS:-0}
  fi
  if [ "${OLD_EXPORTS//[[:space:]]/}" -gt 0 ]; then
    echo -e "${WARN}${OLD_EXPORTS} export file(s) beyond the 10 most recent"
    echo -e "  ${TIP} Run: find backend/exports -type f | sort -r | tail -n +11 | xargs rm -f"
  else
    echo -e "${OK}Export files within retention limit — OK"
  fi
fi

echo ""
echo "=== End of Report ==="
