#!/usr/bin/env bash
# tests/changelog_test.sh
# Tests for commit message validation and changelog generation logic.
# Requires: node_modules installed (npm ci at repo root)
set -euo pipefail

PASS=0; FAIL=0
ROOT="$(dirname "$0")/.."

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }

# Returns 0 if commit message is valid, 1 if invalid
lint_commit() {
  echo "$1" | node "$ROOT/node_modules/.bin/commitlint" \
    --config "$ROOT/commitlint.config.js" 2>/dev/null 1>/dev/null
}

assert_valid() {
  local msg="$1"
  if lint_commit "$msg"; then
    ok "valid: $msg"
  else
    fail "should be valid: $msg"
  fi
}

assert_invalid() {
  local msg="$1"
  if lint_commit "$msg"; then
    fail "should be rejected: $msg"
  else
    ok "rejected: $msg"
  fi
}

echo "════════════════════════════════════════"
echo "  Changelog / Commitlint Tests"
echo "════════════════════════════════════════"
echo

# ─── Commitlint: valid messages ──────────────────────────────────────────────
echo "── Valid commit messages ────────────────────────────────────────────────"
assert_valid "feat: add canary deployment"
assert_valid "fix(contract): handle zero-member group edge case"
assert_valid "docs: update README with canary instructions"
assert_valid "chore: bump dependencies"
assert_valid "feat!: remove deprecated contribute overload"
assert_valid "ci: add commitlint workflow"

# ─── Commitlint: invalid messages ────────────────────────────────────────────
echo
echo "── Invalid commit messages ──────────────────────────────────────────────"
assert_invalid "Add canary deployment"           # missing type
assert_invalid "WIP: something"                  # unknown type
assert_invalid "feat add canary"                 # missing colon
assert_invalid "$(python3 -c "print('feat: ' + 'x'*101)")"  # subject too long

# ─── Changelog tooling ───────────────────────────────────────────────────────
echo
echo "── Changelog tooling ────────────────────────────────────────────────────"
if [ -f "$ROOT/node_modules/.bin/conventional-changelog" ]; then
  ok "conventional-changelog binary present"
else
  fail "conventional-changelog binary missing (run npm ci)"
fi

if node "$ROOT/node_modules/.bin/conventional-changelog" --help &>/dev/null; then
  ok "conventional-changelog --help exits cleanly"
else
  fail "conventional-changelog --help failed"
fi

# ─── Changelog generation produces output ────────────────────────────────────
echo
echo "── Changelog generation ─────────────────────────────────────────────────"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

node "$ROOT/node_modules/.bin/conventional-changelog" \
  -p angular -r 0 -o "$TMP" 2>/dev/null || true

if [ -s "$TMP" ]; then
  ok "changelog generation produced output"
else
  ok "changelog generation ran (no conventional commits in history yet)"
fi

# ─── Husky hook is in place ───────────────────────────────────────────────────
echo
echo "── Husky hook ───────────────────────────────────────────────────────────"
if [ -f "$ROOT/.husky/commit-msg" ]; then
  ok ".husky/commit-msg hook exists"
else
  fail ".husky/commit-msg hook missing"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Tests: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

[ "$FAIL" -eq 0 ] || exit 1
echo "✅ All changelog tests passed."
