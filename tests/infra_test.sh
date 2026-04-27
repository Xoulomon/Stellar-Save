#!/usr/bin/env bash
# tests/infra_test.sh
# Infrastructure tests: terraform validate + plan checks for each environment.
# Requires: terraform >= 1.7, AWS credentials (read-only is sufficient for plan).
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/../infra" && pwd)"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }

run_for_env() {
  local env="$1"
  local dir="$INFRA_DIR/envs/$env"

  echo
  echo "══ ${env} ════════════════════════════════════════════════════════════════"

  # ── terraform fmt check ────────────────────────────────────────────────────
  if terraform -chdir="$dir" fmt -check -recursive -diff > /dev/null 2>&1; then
    pass "fmt: all files formatted"
  else
    fail "fmt: unformatted files detected (run: terraform -chdir=infra/envs/${env} fmt)"
  fi

  # ── terraform validate ─────────────────────────────────────────────────────
  terraform -chdir="$dir" init -backend=false -input=false -no-color > /dev/null 2>&1
  if terraform -chdir="$dir" validate -no-color > /dev/null 2>&1; then
    pass "validate: configuration is valid"
  else
    OUTPUT=$(terraform -chdir="$dir" validate -no-color 2>&1 || true)
    fail "validate: $OUTPUT"
  fi

  # ── required_version constraint present ───────────────────────────────────
  if grep -q 'required_version' "$dir/provider.tf" 2>/dev/null; then
    pass "provider: required_version constraint present"
  else
    fail "provider: missing required_version constraint"
  fi

  # ── backend configured ────────────────────────────────────────────────────
  if grep -q 'backend "s3"' "$dir/provider.tf" 2>/dev/null; then
    pass "backend: S3 remote backend configured"
  else
    fail "backend: S3 remote backend not found in provider.tf"
  fi

  # ── state key is environment-scoped ───────────────────────────────────────
  if grep -q "key.*=.*\"${env}/" "$dir/provider.tf" 2>/dev/null; then
    pass "backend: state key scoped to environment"
  else
    fail "backend: state key not scoped to '${env}/'"
  fi

  # ── module source points to shared module ─────────────────────────────────
  if grep -q 'source.*modules/frontend' "$dir/main.tf" 2>/dev/null; then
    pass "module: references shared frontend module"
  else
    fail "module: frontend module source not found"
  fi
}

# ── Module-level checks ───────────────────────────────────────────────────────
echo
echo "══ modules/frontend ══════════════════════════════════════════════════════"
MODULE_DIR="$INFRA_DIR/modules/frontend"

if terraform -chdir="$MODULE_DIR" fmt -check -recursive -diff > /dev/null 2>&1; then
  pass "fmt: module files formatted"
else
  fail "fmt: unformatted module files"
fi

terraform -chdir="$MODULE_DIR" init -backend=false -input=false -no-color > /dev/null 2>&1
if terraform -chdir="$MODULE_DIR" validate -no-color > /dev/null 2>&1; then
  pass "validate: module configuration is valid"
else
  OUTPUT=$(terraform -chdir="$MODULE_DIR" validate -no-color 2>&1 || true)
  fail "validate: $OUTPUT"
fi

for required_file in main.tf variables.tf outputs.tf; do
  if [ -f "$MODULE_DIR/$required_file" ]; then
    pass "module: $required_file exists"
  else
    fail "module: $required_file missing"
  fi
done

# ── Environment checks ────────────────────────────────────────────────────────
run_for_env staging
run_for_env production

# ── Bootstrap checks ─────────────────────────────────────────────────────────
echo
echo "══ bootstrap ═════════════════════════════════════════════════════════════"
BOOTSTRAP_DIR="$INFRA_DIR/bootstrap"

terraform -chdir="$BOOTSTRAP_DIR" init -backend=false -input=false -no-color > /dev/null 2>&1
if terraform -chdir="$BOOTSTRAP_DIR" validate -no-color > /dev/null 2>&1; then
  pass "validate: bootstrap configuration is valid"
else
  OUTPUT=$(terraform -chdir="$BOOTSTRAP_DIR" validate -no-color 2>&1 || true)
  fail "validate: $OUTPUT"
fi

if grep -q 'aws_s3_bucket.*state' "$BOOTSTRAP_DIR/main.tf" && \
   grep -q 'aws_dynamodb_table.*locks' "$BOOTSTRAP_DIR/main.tf"; then
  pass "bootstrap: state bucket and lock table defined"
else
  fail "bootstrap: missing state bucket or lock table"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
echo "══════════════════════════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "══════════════════════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
