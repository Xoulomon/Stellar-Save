#!/usr/bin/env bash
# scripts/pre_deploy_check.sh
# Pre-deployment validation gate.
# Exits non-zero on any failure — blocks the pipeline.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/contracts/stellar-save/Cargo.toml"
WASM="$ROOT/target/wasm32-unknown-unknown/release/stellar_save.wasm"
WASM_SIZE_LIMIT_KB="${WASM_SIZE_LIMIT_KB:-100}"

PASS=0
FAIL=0

ok()   { echo "  ✅  $*"; ((PASS++)) || true; }
fail() { echo "  ❌  $*"; ((FAIL++)) || true; }
section() { echo; echo "── $* ──────────────────────────────────────────"; }

# ─── 1. Clippy (deny warnings) ───────────────────────────────────────────────
section "Clippy"
if cargo clippy \
    --manifest-path "$MANIFEST" \
    --target wasm32-unknown-unknown \
    --release \
    -- -D warnings 2>&1; then
  ok "Clippy clean"
else
  fail "Clippy reported warnings/errors"
fi

# ─── 2. Rust security audit ──────────────────────────────────────────────────
section "cargo audit"
if command -v cargo-audit &>/dev/null; then
  if cargo audit --manifest-path "$MANIFEST" 2>&1; then
    ok "No known vulnerabilities"
  else
    fail "cargo audit found vulnerabilities"
  fi
else
  echo "  ⚠️  cargo-audit not installed — skipping (install with: cargo install cargo-audit)"
fi

# ─── 3. WASM size check ──────────────────────────────────────────────────────
section "WASM size"
# Build if not already present
if [ ! -f "$WASM" ]; then
  echo "  Building WASM..."
  cargo build \
    --manifest-path "$MANIFEST" \
    --target wasm32-unknown-unknown \
    --release --quiet
fi

if [ -f "$WASM" ]; then
  SIZE_KB=$(du -k "$WASM" | awk '{print $1}')
  echo "  WASM size: ${SIZE_KB} KB (limit: ${WASM_SIZE_LIMIT_KB} KB)"
  if [ "$SIZE_KB" -le "$WASM_SIZE_LIMIT_KB" ]; then
    ok "WASM size within limit (${SIZE_KB} KB ≤ ${WASM_SIZE_LIMIT_KB} KB)"
  else
    fail "WASM too large: ${SIZE_KB} KB > ${WASM_SIZE_LIMIT_KB} KB"
  fi
else
  fail "WASM file not found after build: $WASM"
fi

# ─── 4. Secrets / credential leak scan ──────────────────────────────────────
section "Secrets scan"
PATTERNS=(
  'S[0-9A-Z]{55}'                  # Stellar secret key (starts with S)
  'PRIVATE[_\s]*KEY'
  'BEGIN (RSA|EC|OPENSSH) PRIVATE'
  'AWS_SECRET_ACCESS_KEY\s*='
  'password\s*=\s*["\x27][^"\x27]{8,}'
)

SECRETS_FOUND=0
for pattern in "${PATTERNS[@]}"; do
  # Search staged/tracked files only, skip binary and .git
  if git -C "$ROOT" grep -rIiE "$pattern" \
      --exclude-dir=.git \
      --exclude-dir=target \
      --exclude-dir=node_modules \
      -- '*.rs' '*.toml' '*.sh' '*.yml' '*.yaml' '*.env*' '*.json' 2>/dev/null | \
      grep -v '\.example' | grep -v 'test' | grep -q .; then
    fail "Potential secret pattern found: $pattern"
    SECRETS_FOUND=1
  fi
done
[ "$SECRETS_FOUND" -eq 0 ] && ok "No secret patterns detected"

# ─── 5. Ensure .env is not tracked ───────────────────────────────────────────
section ".env tracking check"
if git -C "$ROOT" ls-files --error-unmatch .env &>/dev/null 2>&1; then
  fail ".env is tracked by git — remove it with: git rm --cached .env"
else
  ok ".env is not tracked"
fi

# ─── 6. Contract tests must pass ─────────────────────────────────────────────
section "Contract unit tests"
if cargo test \
    --manifest-path "$MANIFEST" \
    -- --test-threads=1 --quiet 2>&1; then
  ok "All contract tests passed"
else
  fail "Contract tests failed"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════"
echo "  Pre-deploy checks: ${PASS} passed, ${FAIL} failed"
echo "════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 Deployment blocked — fix the issues above."
  exit 1
fi

echo "🚀 All checks passed — ready to deploy."
