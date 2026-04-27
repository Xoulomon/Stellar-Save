#!/usr/bin/env bash
# scripts/bg_health_check.sh
# Runs health checks against a blue/green slot before or after a switch.
#
# Required env vars:
#   CHECK_SLOT   — blue | green | live
#   DEPLOY_ENV   — staging | production
#   DEPLOY_HOST  — base URL (e.g. https://example.com)
#
# Optional:
#   HEALTH_RETRIES      — number of retry attempts (default: 5)
#   HEALTH_RETRY_DELAY  — seconds between retries (default: 10)
#   HEALTH_TIMEOUT      — curl timeout per request in seconds (default: 10)
set -euo pipefail

: "${CHECK_SLOT:?}"
: "${DEPLOY_ENV:?}"
: "${DEPLOY_HOST:?}"

RETRIES="${HEALTH_RETRIES:-5}"
RETRY_DELAY="${HEALTH_RETRY_DELAY:-10}"
TIMEOUT="${HEALTH_TIMEOUT:-10}"
REGISTRY="deployment-records/frontend-active.json"

cd "$(dirname "$0")/.."

# ─── Resolve URL for the slot ─────────────────────────────────────────────────
if [ "$CHECK_SLOT" = "live" ]; then
  SLOT_URL="${DEPLOY_HOST}"
else
  # Slot-specific preview URL — adjust pattern for your host
  SLOT_URL="${DEPLOY_HOST}/${DEPLOY_ENV}/${CHECK_SLOT}"
fi

echo "════════════════════════════════════════"
echo "  HEALTH CHECK — slot: ${CHECK_SLOT}"
echo "  URL: ${SLOT_URL}"
echo "════════════════════════════════════════"

# ─── Helper: HTTP check ───────────────────────────────────────────────────────
http_check() {
  local url="$1"
  local expected_status="${2:-200}"
  local status
  status=$(curl -fsSL --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$status" = "$expected_status" ]; then
    echo "  ✅ GET ${url} → ${status}"
    return 0
  else
    echo "  ❌ GET ${url} → ${status} (expected ${expected_status})"
    return 1
  fi
}

# ─── Helper: retry wrapper ────────────────────────────────────────────────────
retry() {
  local attempt=1
  until "$@"; do
    if [ "$attempt" -ge "$RETRIES" ]; then
      echo "❌ Health check failed after ${RETRIES} attempts." >&2
      return 1
    fi
    echo "  ↻ Retry ${attempt}/${RETRIES} in ${RETRY_DELAY}s…"
    sleep "$RETRY_DELAY"
    attempt=$((attempt + 1))
  done
}

# ─── Checks ───────────────────────────────────────────────────────────────────
FAILED=0

echo
echo "── 1. Root page reachable ───────────────────────────────────────────────"
retry http_check "${SLOT_URL}/" 200 || FAILED=1

echo
echo "── 2. Static assets reachable ───────────────────────────────────────────"
# Check that the Vite-generated index.html references at least one JS asset
INDEX_CONTENT=$(curl -fsSL --max-time "$TIMEOUT" "${SLOT_URL}/" 2>/dev/null || echo "")
if echo "$INDEX_CONTENT" | grep -q 'src="/assets/'; then
  echo "  ✅ index.html contains asset references"
else
  echo "  ⚠️  index.html asset references not found (may be normal for SPA)"
fi

echo
echo "── 3. No server error responses ─────────────────────────────────────────"
STATUS=$(curl -fsSL --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "${SLOT_URL}/" 2>/dev/null || echo "000")
if [[ "$STATUS" =~ ^5 ]]; then
  echo "  ❌ Server returned 5xx: ${STATUS}" >&2
  FAILED=1
elif [[ "$STATUS" = "000" ]]; then
  echo "  ❌ Could not connect to ${SLOT_URL}" >&2
  FAILED=1
else
  echo "  ✅ No 5xx errors (status: ${STATUS})"
fi

echo
echo "── 4. Response time check ───────────────────────────────────────────────"
RESPONSE_TIME=$(curl -fsSL --max-time "$TIMEOUT" -o /dev/null \
  -w "%{time_total}" "${SLOT_URL}/" 2>/dev/null || echo "999")
THRESHOLD="5.0"
if awk "BEGIN{exit !($RESPONSE_TIME < $THRESHOLD)}"; then
  echo "  ✅ Response time ${RESPONSE_TIME}s < ${THRESHOLD}s"
else
  echo "  ⚠️  Response time ${RESPONSE_TIME}s ≥ ${THRESHOLD}s (slow but not failing)"
fi

# ─── Result ───────────────────────────────────────────────────────────────────
echo
if [ "$FAILED" -eq 0 ]; then
  echo "════════════════════════════════════════"
  echo "  ✅ Health checks passed for ${CHECK_SLOT}"
  echo "════════════════════════════════════════"
  exit 0
else
  echo "════════════════════════════════════════"
  echo "  ❌ Health checks FAILED for ${CHECK_SLOT}"
  echo "════════════════════════════════════════"
  exit 1
fi
