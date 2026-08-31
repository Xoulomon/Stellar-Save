#!/usr/bin/env bash
# scripts/ssl_rotation_test.sh
#
# Smoke test for SSL certificate rotation and OCSP stapling (Issue #1168).
# Usage: ./scripts/ssl_rotation_test.sh <domain> [port]
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed

set -euo pipefail

DOMAIN="${1:-api.stellar-save.io}"
PORT="${2:-443}"
MIN_DAYS_UNTIL_EXPIRY=30
FAILURES=0

red()   { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
info()  { echo -e "\033[36m$*\033[0m"; }

fail() { red "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
pass() { green "PASS: $*"; }

info "=== SSL Rotation Smoke Test: ${DOMAIN}:${PORT} ==="

# ── 1. TLS handshake succeeds ─────────────────────────────────────────────────
info "1. TLS handshake..."
if echo | openssl s_client -connect "${DOMAIN}:${PORT}" -servername "${DOMAIN}" \
    -tls1_2 </dev/null 2>&1 | grep -q "Verify return code: 0"; then
  pass "TLS 1.2 handshake"
else
  fail "TLS 1.2 handshake failed"
fi

if echo | openssl s_client -connect "${DOMAIN}:${PORT}" -servername "${DOMAIN}" \
    -tls1_3 </dev/null 2>&1 | grep -q "Verify return code: 0"; then
  pass "TLS 1.3 handshake"
else
  fail "TLS 1.3 handshake failed"
fi

# ── 2. OCSP stapling response is present ─────────────────────────────────────
info "2. OCSP stapling..."
OCSP_STATUS=$(echo | openssl s_client -connect "${DOMAIN}:${PORT}" \
    -servername "${DOMAIN}" -status </dev/null 2>&1 | grep "OCSP Response Status" || true)

if [[ "$OCSP_STATUS" == *"successful"* ]]; then
  pass "OCSP stapling: $OCSP_STATUS"
else
  fail "OCSP stapling response not found or unsuccessful (got: '${OCSP_STATUS}')"
fi

# ── 3. Certificate expiry is > MIN_DAYS_UNTIL_EXPIRY ─────────────────────────
info "3. Certificate expiry (must be > ${MIN_DAYS_UNTIL_EXPIRY} days)..."
CERT_END_DATE=$(echo | openssl s_client -connect "${DOMAIN}:${PORT}" \
    -servername "${DOMAIN}" </dev/null 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null \
  | cut -d= -f2)

if [[ -z "$CERT_END_DATE" ]]; then
  fail "Could not retrieve certificate expiry date"
else
  EXPIRY_EPOCH=$(date -d "$CERT_END_DATE" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$CERT_END_DATE" +%s 2>/dev/null)
  NOW_EPOCH=$(date +%s)
  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

  if [[ $DAYS_LEFT -gt $MIN_DAYS_UNTIL_EXPIRY ]]; then
    pass "Certificate expires in ${DAYS_LEFT} days (${CERT_END_DATE})"
  else
    fail "Certificate expires in only ${DAYS_LEFT} days — renewal required (${CERT_END_DATE})"
  fi
fi

# ── 4. Subject Alternative Names ─────────────────────────────────────────────
info "4. Subject Alternative Names..."
SANS=$(echo | openssl s_client -connect "${DOMAIN}:${PORT}" \
    -servername "${DOMAIN}" </dev/null 2>/dev/null \
  | openssl x509 -noout -text 2>/dev/null \
  | grep -A1 "Subject Alternative Name" | tail -1 || true)

if [[ -n "$SANS" ]]; then
  pass "SANs present: ${SANS}"
else
  fail "No Subject Alternative Names found"
fi

# ── 5. Minimum TLS version enforced (TLS 1.0 must be rejected) ───────────────
info "5. TLS 1.0 must be rejected..."
TLS1_OUTPUT=$(echo | openssl s_client -connect "${DOMAIN}:${PORT}" \
    -servername "${DOMAIN}" -tls1 </dev/null 2>&1 || true)

if echo "$TLS1_OUTPUT" | grep -qiE "handshake failure|alert|unsupported"; then
  pass "TLS 1.0 correctly rejected"
else
  fail "TLS 1.0 was accepted — minimum version policy not enforced"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [[ $FAILURES -eq 0 ]]; then
  green "All SSL checks passed for ${DOMAIN}"
  exit 0
else
  red "${FAILURES} check(s) failed for ${DOMAIN}"
  exit 1
fi
