#!/usr/bin/env bash
# tests/blue_green_test.sh
# Tests for the blue-green deployment scripts.
# Runs entirely locally with no external dependencies.
set -euo pipefail

PASS=0
FAIL=0
SCRIPTS_DIR="$(cd "$(dirname "$0")/../scripts" && pwd)"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ─── Helpers ──────────────────────────────────────────────────────────────────
pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then pass "$desc"
  else fail "$desc (expected='${expected}' got='${actual}')"; fi
}

assert_file_contains() {
  local desc="$1" file="$2" pattern="$3"
  if grep -q "$pattern" "$file" 2>/dev/null; then pass "$desc"
  else fail "$desc (pattern '${pattern}' not found in ${file})"; fi
}

assert_exit_nonzero() {
  local desc="$1"; shift
  if ! "$@" 2>/dev/null; then pass "$desc"
  else fail "$desc (expected non-zero exit)"; fi
}

# ─── Setup: fake dist dir and registry dir ────────────────────────────────────
setup_env() {
  local dir="$1"
  mkdir -p "$dir/dist" "$dir/deployment-records"
  echo "<html><head></head><body><script src=\"/assets/index.js\"></script></body></html>" \
    > "$dir/dist/index.html"
  export DEPLOY_ENV="staging"
  export DEPLOY_HOST="http://localhost:9999"
  export DEPLOY_TOKEN="test-token"
  export DIST_DIR="$dir/dist"
  export BG_REGISTRY="$dir/deployment-records/frontend-active.json"
}

# ─── Test: bg_deploy.sh ───────────────────────────────────────────────────────
echo
echo "══ bg_deploy.sh ══════════════════════════════════════════════════════════"

T="$TMPDIR/deploy"
mkdir -p "$T"
setup_env "$T"

(
  cd "$T"
  TARGET_SLOT=blue BUILD_HASH=abc123 COMMIT_SHA=deadbeef \
    bash "$SCRIPTS_DIR/bg_deploy.sh" > /dev/null
)
assert_file_contains "registry created after deploy" \
  "$T/deployment-records/frontend-active.json" "blue_build_hash"
assert_file_contains "build hash written to registry" \
  "$T/deployment-records/frontend-active.json" "abc123"

# Invalid slot should fail
(
  cd "$T"
  assert_exit_nonzero "invalid slot exits non-zero" \
    env TARGET_SLOT=purple BUILD_HASH=x COMMIT_SHA=x \
      bash "$SCRIPTS_DIR/bg_deploy.sh"
)

# Missing dist dir should fail
(
  cd "$T"
  assert_exit_nonzero "missing dist dir exits non-zero" \
    env TARGET_SLOT=blue BUILD_HASH=x COMMIT_SHA=x DIST_DIR=/nonexistent \
      bash "$SCRIPTS_DIR/bg_deploy.sh"
)

# ─── Test: bg_switch.sh ───────────────────────────────────────────────────────
echo
echo "══ bg_switch.sh ══════════════════════════════════════════════════════════"

T="$TMPDIR/switch"
mkdir -p "$T/deployment-records"
setup_env "$T"

# Seed registry with blue as live
python3 -c "
import json
data = {'live_slot': 'blue', 'previous_slot': 'unknown', 'environment': 'staging'}
with open('$T/deployment-records/frontend-active.json', 'w') as f:
    json.dump(data, f)
"

(
  cd "$T"
  TARGET_SLOT=green bash "$SCRIPTS_DIR/bg_switch.sh" > /dev/null
)
LIVE=$(python3 -c "import json; d=json.load(open('$T/deployment-records/frontend-active.json')); print(d['live_slot'])")
assert_eq "live slot updated to green" "green" "$LIVE"

PREV=$(python3 -c "import json; d=json.load(open('$T/deployment-records/frontend-active.json')); print(d['previous_slot'])")
assert_eq "previous slot recorded as blue" "blue" "$PREV"

# Switching to already-live slot should be a no-op (exit 0)
(
  cd "$T"
  TARGET_SLOT=green bash "$SCRIPTS_DIR/bg_switch.sh" > /dev/null
)
pass "switching to already-live slot exits 0"

# ─── Test: bg_rollback.sh ─────────────────────────────────────────────────────
echo
echo "══ bg_rollback.sh ════════════════════════════════════════════════════════"

T="$TMPDIR/rollback"
mkdir -p "$T/deployment-records"
setup_env "$T"

# Seed registry: green is live, blue is previous
python3 -c "
import json
data = {'live_slot': 'green', 'previous_slot': 'blue', 'environment': 'staging'}
with open('$T/deployment-records/frontend-active.json', 'w') as f:
    json.dump(data, f)
"

(
  cd "$T"
  ROLLBACK_REASON=test bash "$SCRIPTS_DIR/bg_rollback.sh" > /dev/null
)
LIVE=$(python3 -c "import json; d=json.load(open('$T/deployment-records/frontend-active.json')); print(d['live_slot'])")
assert_eq "rollback switches live to blue" "blue" "$LIVE"

REASON=$(python3 -c "import json; d=json.load(open('$T/deployment-records/frontend-active.json')); print(d.get('rollback_reason',''))")
assert_eq "rollback reason recorded" "test" "$REASON"

# Rollback with no registry should fail
(
  cd "$TMPDIR"
  assert_exit_nonzero "rollback without registry exits non-zero" \
    env BG_REGISTRY="$TMPDIR/nonexistent/frontend-active.json" \
      DEPLOY_ENV=staging DEPLOY_HOST=http://localhost DEPLOY_TOKEN=x \
      bash "$SCRIPTS_DIR/bg_rollback.sh"
)

# Rollback when previous_slot is unknown should fail
python3 -c "
import json
data = {'live_slot': 'green', 'previous_slot': 'unknown', 'environment': 'staging'}
with open('$T/deployment-records/frontend-active.json', 'w') as f:
    json.dump(data, f)
"
(
  cd "$T"
  assert_exit_nonzero "rollback with unknown previous slot exits non-zero" \
    env BG_REGISTRY="$T/deployment-records/frontend-active.json" \
      DEPLOY_ENV=staging DEPLOY_HOST=http://localhost DEPLOY_TOKEN=x \
      bash "$SCRIPTS_DIR/bg_rollback.sh"
)

# ─── Test: bg_health_check.sh (offline mode) ──────────────────────────────────
echo
echo "══ bg_health_check.sh ════════════════════════════════════════════════════"

T="$TMPDIR/health"
mkdir -p "$T"
setup_env "$T"

# Health check against a non-existent host should fail
(
  cd "$T"
  assert_exit_nonzero "health check against unreachable host fails" \
    env CHECK_SLOT=blue DEPLOY_ENV=staging DEPLOY_HOST=http://localhost:19999 \
      HEALTH_RETRIES=1 HEALTH_RETRY_DELAY=0 \
      bash "$SCRIPTS_DIR/bg_health_check.sh"
)

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "══════════════════════════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "══════════════════════════════════════════════════════════════════════════"

[ "$FAIL" -eq 0 ]
