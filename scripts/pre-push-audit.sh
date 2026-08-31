#!/usr/bin/env bash
# pre-push-audit.sh — Local vulnerability scan before push.
#
# Runs npm audit (frontend + backend) and cargo audit against
# known CVE databases. Exits non-zero on any HIGH or CRITICAL finding,
# blocking the push so the developer can triage before sharing the branch.
#
# Usage:
#   ./scripts/pre-push-audit.sh          # Run all audits
#   ./scripts/pre-push-audit.sh --npm    # npm audit only
#   ./scripts/pre-push-audit.sh --cargo  # cargo audit only
#
# Triage guide (see docs/dependency-update-policy.md):
#   - CRITICAL / HIGH  → fix or document accepted risk before pushing
#   - MODERATE / LOW   → log and track; do not block push
#
# CI/CD note: this script is for LOCAL pre-push use only. The CI pipeline
# has its own scanning step (see .github/workflows/dependency-scan.yml).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

pass() { echo -e "${GREEN}✔${NC}  $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✖${NC}  $*"; }
header() { echo -e "\n${BOLD}── $* ──${NC}"; }

# ── Argument parsing ──────────────────────────────────────────────────────────
RUN_NPM=true
RUN_CARGO=true

for arg in "$@"; do
  case "$arg" in
    --npm)   RUN_CARGO=false ;;
    --cargo) RUN_NPM=false ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

FAILED=0

# ── npm audit ─────────────────────────────────────────────────────────────────
run_npm_audit() {
  local dir="$1"
  local label="$2"

  header "npm audit — $label ($dir)"

  if [ ! -f "$dir/package.json" ]; then
    warn "No package.json found in $dir — skipping"
    return
  fi

  if ! command -v npm &>/dev/null; then
    warn "npm not found — skipping $label npm audit"
    return
  fi

  # Run audit and capture exit code without aborting on failure
  local output
  output=$(cd "$dir" && npm audit --audit-level=high 2>&1) && local exit_code=$? || local exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    pass "$label: no HIGH/CRITICAL npm vulnerabilities found"
  else
    fail "$label: HIGH or CRITICAL npm vulnerabilities detected"
    echo "$output"
    echo ""
    echo "  Fix options:"
    echo "    cd $dir && npm audit fix"
    echo "    cd $dir && npm audit fix --force  (may introduce breaking changes)"
    echo "    See docs/dependency-update-policy.md to document accepted risk"
    FAILED=1
  fi
}

# ── cargo audit ───────────────────────────────────────────────────────────────
run_cargo_audit() {
  header "cargo audit"

  if ! command -v cargo-audit &>/dev/null && ! cargo audit --version &>/dev/null 2>&1; then
    warn "cargo-audit not installed — skipping Rust audit"
    warn "Install with: cargo install cargo-audit"
    return
  fi

  # .cargo/audit.toml sets severity_threshold = "critical" for the workspace.
  # Here we override to catch HIGH as well (--deny warnings covers high+critical).
  local output
  output=$(cd "$REPO_ROOT" && cargo audit --deny warnings 2>&1) && local exit_code=$? || local exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    pass "Rust: no HIGH/CRITICAL cargo vulnerabilities found"
  else
    fail "Rust: HIGH or CRITICAL cargo vulnerabilities detected"
    echo "$output"
    echo ""
    echo "  Fix options:"
    echo "    cargo update <crate>          # upgrade to patched version"
    echo "    Edit .cargo/audit.toml to document accepted risk with [advisories]"
    echo "    See docs/dependency-update-policy.md for triage policy"
    FAILED=1
  fi
}

# ── Run audits ────────────────────────────────────────────────────────────────
echo -e "${BOLD}Stellar-Save — pre-push dependency audit${NC}"
echo "Repo: $REPO_ROOT"

if $RUN_NPM; then
  run_npm_audit "$REPO_ROOT/frontend"  "frontend"
  run_npm_audit "$REPO_ROOT/backend"   "backend"
fi

if $RUN_CARGO; then
  run_cargo_audit
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$FAILED" -eq 0 ]; then
  pass "All audits passed. Safe to push."
  exit 0
else
  fail "One or more audits found HIGH/CRITICAL vulnerabilities."
  fail "Fix the issues above, or document accepted risk per docs/dependency-update-policy.md"
  fail "then re-run this script before pushing."
  exit 1
fi
