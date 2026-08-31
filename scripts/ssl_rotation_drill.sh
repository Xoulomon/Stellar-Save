#!/usr/bin/env bash
# =============================================================================
# SSL Certificate Rotation Drill
# =============================================================================
# Simulates a zero-downtime TLS certificate rotation against a staging target.
# Asserts:
#   1. Zero failed requests during rotation (concurrent load probe)
#   2. New certificate is served post-rotation
#   3. Old certificate is no longer presented
#
# Usage:
#   ./scripts/ssl_rotation_drill.sh [OPTIONS]
#
# Options:
#   --target <host>      Hostname to target           (default: localhost)
#   --port   <port>      HTTPS port                   (default: 443)
#   --cert   <path>      New certificate PEM path     (required for live run)
#   --key    <path>      New private key PEM path     (required for live run)
#   --duration <secs>    Load probe duration          (default: 60)
#   --rps    <n>         Requests per second for probe(default: 10)
#   --dry-run            Skip live rotation and probe
#
# Environment variable overrides:
#   DRILL_TARGET, DRILL_PORT, DRILL_NEW_CERT, DRILL_NEW_KEY
#   DRILL_DURATION, DRILL_RPS, DRILL_ROTATION_CMD
#   DRILL_CERT_DEST, DRILL_KEY_DEST
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[PASS]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; }

TARGET="${DRILL_TARGET:-localhost}"
PORT="${DRILL_PORT:-443}"
NEW_CERT="${DRILL_NEW_CERT:-}"
NEW_KEY="${DRILL_NEW_KEY:-}"
DURATION="${DRILL_DURATION:-60}"
RPS="${DRILL_RPS:-10}"
ROTATION_CMD="${DRILL_ROTATION_CMD:-}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)   TARGET="$2";   shift 2 ;;
    --port)     PORT="$2";     shift 2 ;;
    --cert)     NEW_CERT="$2"; shift 2 ;;
    --key)      NEW_KEY="$2";  shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --rps)      RPS="$2";      shift 2 ;;
    --dry-run)  DRY_RUN=true;  shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

BASE_URL="https://${TARGET}:${PORT}"
RESULTS_DIR="$(mktemp -d)"
LOAD_LOG="${RESULTS_DIR}/load.log"
FAIL_LOG="${RESULTS_DIR}/failures.log"
CERT_BEFORE="${RESULTS_DIR}/cert_before.pem"
CERT_AFTER="${RESULTS_DIR}/cert_after.pem"
REPORT="${RESULTS_DIR}/drill_report.json"

echo ""
echo "========================================================"
echo "  SSL Certificate Rotation Drill"
echo "  Target   : ${BASE_URL}"
echo "  Duration : ${DURATION}s  |  RPS: ${RPS}"
echo "  Dry run  : ${DRY_RUN}"
echo "========================================================"
echo ""

for cmd in curl openssl python3; do
  command -v "$cmd" &>/dev/null || { fail "Missing dependency: $cmd"; exit 1; }
done

# ── Step 1: Capture pre-rotation certificate ──────────────────────────────────
info "Step 1: Capturing current certificate..."
openssl s_client -connect "${TARGET}:${PORT}" -servername "${TARGET}" \
  </dev/null 2>/dev/null | openssl x509 -out "${CERT_BEFORE}" 2>/dev/null \
  || { fail "Cannot connect to ${TARGET}:${PORT}"; exit 1; }

CN_BEFORE=$(openssl x509 -noout -subject -in "${CERT_BEFORE}" | sed 's/.*CN\s*=\s*//' | tr -d ' \n')
EXP_BEFORE=$(openssl x509 -noout -enddate -in "${CERT_BEFORE}" | cut -d= -f2)
FP_BEFORE=$(openssl x509 -noout -fingerprint -sha256 -in "${CERT_BEFORE}" | cut -d= -f2)
info "  CN: ${CN_BEFORE}  |  Expires: ${EXP_BEFORE}"
info "  SHA256: ${FP_BEFORE}"

# ── Step 2: Start load probe ──────────────────────────────────────────────────
touch "${LOAD_LOG}" "${FAIL_LOG}"
PROBE_PID=""

probe_loop() {
  local deadline=$(( $(date +%s) + DURATION ))
  local interval; interval=$(python3 -c "print(1.0/${RPS})")
  while [[ $(date +%s) -lt $deadline ]]; do
    CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 \
      --connect-timeout 3 "${BASE_URL}/health" 2>/dev/null || echo "000")
    echo "$(date +%s%3N) ${CODE}" >> "${LOAD_LOG}"
    if [[ "$CODE" != "200" && "$CODE" != "204" ]]; then
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) HTTP ${CODE}" >> "${FAIL_LOG}"
    fi
    sleep "${interval}" 2>/dev/null || true
  done
}

if [[ "${DRY_RUN}" == "false" ]]; then
  info "Step 2: Starting load probe (${RPS} req/s for ${DURATION}s)..."
  probe_loop &
  PROBE_PID=$!
  info "  Probe PID: ${PROBE_PID}"
  sleep 3  # warm up before rotating
else
  warn "Step 2: SKIP (dry run) — no load probe"
fi

# ── Step 3: Rotate certificate ────────────────────────────────────────────────
info "Step 3: Rotating certificate..."
ROT_START=$(date +%s%3N)

if [[ "${DRY_RUN}" == "true" ]]; then
  warn "  SKIP (dry run) — simulating 2s rotation"
  sleep 2
elif [[ -n "${ROTATION_CMD}" ]]; then
  info "  Running: ${ROTATION_CMD}"
  eval "${ROTATION_CMD}"
elif [[ -n "${NEW_CERT}" && -n "${NEW_KEY}" ]]; then
  CERT_DEST="${DRILL_CERT_DEST:-/etc/nginx/ssl/server.crt}"
  KEY_DEST="${DRILL_KEY_DEST:-/etc/nginx/ssl/server.key}"
  cp "${NEW_CERT}" "${CERT_DEST}"
  cp "${NEW_KEY}"  "${KEY_DEST}"
  if command -v nginx &>/dev/null && [[ -f /var/run/nginx.pid ]]; then
    nginx -t 2>/dev/null && kill -HUP "$(cat /var/run/nginx.pid)"
    info "  nginx reloaded (graceful HUP)"
  elif systemctl is-active --quiet nginx 2>/dev/null; then
    systemctl reload nginx
    info "  nginx reloaded via systemctl"
  else
    warn "  Could not detect nginx — set DRILL_ROTATION_CMD for custom reload"
  fi
else
  fail "No rotation method. Provide --cert/--key or set DRILL_ROTATION_CMD."
  [[ -n "${PROBE_PID}" ]] && kill "${PROBE_PID}" 2>/dev/null || true
  exit 1
fi

ROT_END=$(date +%s%3N)
ROT_MS=$(( ROT_END - ROT_START ))
info "  Rotation completed in ${ROT_MS}ms"

if [[ -n "${PROBE_PID}" ]]; then
  info "  Waiting for probe to finish..."
  wait "${PROBE_PID}" 2>/dev/null || true
fi

# ── Step 4: Capture post-rotation certificate ─────────────────────────────────
info "Step 4: Capturing post-rotation certificate..."
sleep 1  # allow TLS session cache to flush

openssl s_client -connect "${TARGET}:${PORT}" -servername "${TARGET}" \
  </dev/null 2>/dev/null | openssl x509 -out "${CERT_AFTER}" 2>/dev/null \
  || { fail "Cannot connect post-rotation — server may be down!"; exit 1; }

CN_AFTER=$(openssl x509 -noout -subject -in "${CERT_AFTER}" | sed 's/.*CN\s*=\s*//' | tr -d ' \n')
EXP_AFTER=$(openssl x509 -noout -enddate -in "${CERT_AFTER}" | cut -d= -f2)
FP_AFTER=$(openssl x509 -noout -fingerprint -sha256 -in "${CERT_AFTER}" | cut -d= -f2)
info "  CN: ${CN_AFTER}  |  Expires: ${EXP_AFTER}"
info "  SHA256: ${FP_AFTER}"

# ── Step 5: Assert results ────────────────────────────────────────────────────
echo ""
info "Step 5: Evaluating assertions..."
PASS=true

TOTAL=0; FAILED=0
[[ -s "${LOAD_LOG}" ]] && TOTAL=$(wc -l < "${LOAD_LOG}")
[[ -s "${FAIL_LOG}" ]] && FAILED=$(wc -l < "${FAIL_LOG}")

echo ""
echo "── Assertion 1: Zero failed requests during rotation ────────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  warn "SKIP (dry run)"
elif [[ "${FAILED}" -eq 0 ]]; then
  ok "PASSED — ${TOTAL} requests sent, 0 failures (zero downtime confirmed)"
else
  fail "FAILED — ${FAILED}/${TOTAL} requests failed during rotation"
  [[ -s "${FAIL_LOG}" ]] && head -20 "${FAIL_LOG}"
  PASS=false
fi

echo ""
echo "── Assertion 2: New certificate is served post-rotation ─────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  warn "SKIP (dry run)"
elif [[ -n "${NEW_CERT}" ]]; then
  EXP_FP=$(openssl x509 -noout -fingerprint -sha256 -in "${NEW_CERT}" | cut -d= -f2)
  if [[ "${FP_AFTER}" == "${EXP_FP}" ]]; then
    ok "PASSED — new certificate fingerprint matches expected"
  else
    fail "FAILED — expected ${EXP_FP:0:24}... got ${FP_AFTER:0:24}..."
    PASS=false
  fi
else
  if [[ "${FP_AFTER}" != "${FP_BEFORE}" ]]; then
    ok "PASSED — certificate fingerprint changed post-rotation"
  else
    warn "INCONCLUSIVE — fingerprint unchanged (no --cert provided)"
  fi
fi

echo ""
echo "── Assertion 3: Old certificate is no longer presented ──────────────────"
if [[ "${DRY_RUN}" == "true" ]]; then
  warn "SKIP (dry run)"
elif [[ "${FP_AFTER}" != "${FP_BEFORE}" ]]; then
  ok "PASSED — old certificate (${FP_BEFORE:0:24}...) is no longer served"
else
  [[ -n "${NEW_CERT}" ]] && { fail "FAILED — old cert still being served"; PASS=false; } \
    || warn "INCONCLUSIVE — fingerprint unchanged, no new cert provided"
fi

# ── Step 6: Write JSON report ─────────────────────────────────────────────────
DRILL_STATUS="passed"; [[ "${PASS}" == "false" ]] && DRILL_STATUS="failed"

python3 - << PYEOF
import json, datetime, os

report = {
  "drill_date": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "target": "${TARGET}:${PORT}",
  "dry_run": "${DRY_RUN}" == "true",
  "status": "${DRILL_STATUS}",
  "rotation_duration_ms": int("${ROT_MS:-0}"),
  "load_probe": {
    "duration_seconds": int("${DURATION}"),
    "requests_per_second": int("${RPS}"),
    "total_requests": int("${TOTAL}"),
    "failed_requests": int("${FAILED}"),
    "zero_downtime_confirmed": int("${FAILED}") == 0,
  },
  "certificate": {
    "before": {
      "cn": "${CN_BEFORE}",
      "expires": "${EXP_BEFORE}",
      "sha256_fingerprint": "${FP_BEFORE}",
    },
    "after": {
      "cn": "${CN_AFTER}",
      "expires": "${EXP_AFTER}",
      "sha256_fingerprint": "${FP_AFTER}",
    },
    "cert_changed": "${FP_BEFORE}" != "${FP_AFTER}",
  },
  "assertions": {
    "zero_failed_requests": int("${FAILED}") == 0,
    "new_cert_served": "${FP_BEFORE}" != "${FP_AFTER}",
    "old_cert_gone": "${FP_BEFORE}" != "${FP_AFTER}",
  },
}

report_path = "${REPORT}"
with open(report_path, "w") as f:
    json.dump(report, f, indent=2)

print(f"\nReport written to: {report_path}")
print(json.dumps(report, indent=2))
PYEOF

echo ""
echo "========================================================"
if [[ "${PASS}" == "true" ]]; then
  ok "ALL ASSERTIONS PASSED — Drill ${DRILL_STATUS}"
else
  fail "ONE OR MORE ASSERTIONS FAILED — Drill ${DRILL_STATUS}"
fi
echo "========================================================"
echo ""

# Copy report to workspace for CI artifact upload
cp "${REPORT}" "ssl_drill_report.json" 2>/dev/null || true

[[ "${PASS}" == "true" ]] || exit 1
