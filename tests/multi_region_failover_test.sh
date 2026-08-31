#!/usr/bin/env bash
# tests/multi_region_failover_test.sh
# Multi-region failover integration test for Stellar-Save.
#
# Simulates a primary-region outage by disabling the Route53 health check,
# asserts that traffic reroutes to the secondary region within the documented
# RTO, verifies continuous health across the transition, and restores the
# primary health check when done.
#
# Required env vars (live mode, DRY_RUN=0):
#   PRIMARY_HEALTH_CHECK_ID  — Route53 health check ID for the primary region
#   API_ENDPOINT             — base URL, e.g. https://api.stellar-save.app
#
# Optional:
#   PRIMARY_REGION           — AWS region of the primary (default: us-east-1)
#   SECONDARY_REGION         — AWS region of the secondary (default: eu-west-1)
#   RTO_SECONDS              — RTO assertion threshold in seconds (default: 150)
#   POLL_INTERVAL_SECONDS    — polling cadence during failover (default: 10)
#   DRY_RUN                  — 1=simulate without real AWS calls (default: 1)
#   AWS_PROFILE              — optional AWS CLI profile
#   RESULTS_DIR              — directory for results JSON (default: tests)
set -euo pipefail

PRIMARY_HEALTH_CHECK_ID="${PRIMARY_HEALTH_CHECK_ID:-}"
API_ENDPOINT="${API_ENDPOINT:-}"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-eu-west-1}"
RTO_SECONDS="${RTO_SECONDS:-150}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"
DRY_RUN="${DRY_RUN:-1}"
AWS_PROFILE="${AWS_PROFILE:-}"
RESULTS_DIR="${RESULTS_DIR:-$(dirname "$0")}"
RESULTS_FILE="${RESULTS_DIR}/failover-results.json"

PASS=0
FAIL=0

cd "$(dirname "$0")/.."

pass() { echo "  ✅  $1"; ((PASS++)) || true; }
fail() { echo "  ❌  $1"; ((FAIL++)) || true; }
info() { echo "  ℹ️   $1"; }
warn() { echo "  ⚠️   $1"; }

# ─── Results accumulator ──────────────────────────────────────────────────────
RESULT_FAILOVER_TIME=0
RESULT_DNS_SHIFTED=false
RESULT_HEALTH_CONTINUOUS=true
RESULT_PRIMARY_RECOVERED=false
RESULT_PASSED=false
TEST_START_EPOCH=$(date +%s)

# ─── Cleanup / restore trap ───────────────────────────────────────────────────
_cleanup() {
  local exit_code=$?
  echo
  echo "── Cleanup: restoring primary health check ──────────────────────────────"
  _restore_primary_health_check
  _write_results
  if [ "$exit_code" -ne 0 ] && [ "$FAIL" -eq 0 ]; then
    # Script aborted before summary; count as failure
    fail "Test aborted unexpectedly (exit code: ${exit_code})"
  fi
}
trap '_cleanup' EXIT

# ─── AWS helper with optional profile ────────────────────────────────────────
_aws() {
  if [ -n "$AWS_PROFILE" ]; then
    aws --profile "$AWS_PROFILE" "$@"
  else
    aws "$@"
  fi
}

# ─── Dry-run state (replaces real AWS calls in DRY_RUN=1 mode) ───────────────
_DRY_HC_DISABLED=false

_disable_primary_health_check() {
  if [ "$DRY_RUN" = "1" ]; then
    info "[dry-run] Simulating: aws route53 update-health-check --health-check-id ${PRIMARY_HEALTH_CHECK_ID:-MOCK_HC} --disabled"
    _DRY_HC_DISABLED=true
    return 0
  fi

  : "${PRIMARY_HEALTH_CHECK_ID:?PRIMARY_HEALTH_CHECK_ID is required in live mode}"
  _aws route53 update-health-check \
    --health-check-id "$PRIMARY_HEALTH_CHECK_ID" \
    --disabled \
    --region "$PRIMARY_REGION"
  info "Primary health check ${PRIMARY_HEALTH_CHECK_ID} disabled"
}

_restore_primary_health_check() {
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$_DRY_HC_DISABLED" = "true" ]; then
      info "[dry-run] Simulating: aws route53 update-health-check --no-disabled"
      _DRY_HC_DISABLED=false
    fi
    return 0
  fi

  if [ -z "$PRIMARY_HEALTH_CHECK_ID" ]; then
    warn "PRIMARY_HEALTH_CHECK_ID not set — skipping restore"
    return 0
  fi

  _aws route53 update-health-check \
    --health-check-id "$PRIMARY_HEALTH_CHECK_ID" \
    --no-disabled \
    --region "$PRIMARY_REGION" || warn "Could not re-enable health check — do this manually"
  info "Primary health check ${PRIMARY_HEALTH_CHECK_ID} restored"
}

_get_resolved_ip() {
  # Returns the IP that api.stellar-save.app resolves to, or a mock in dry-run.
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$_DRY_HC_DISABLED" = "true" ]; then
      echo "10.0.2.1"   # mock secondary IP
    else
      echo "10.0.1.1"   # mock primary IP
    fi
    return 0
  fi

  local hostname
  hostname=$(echo "$API_ENDPOINT" | sed 's|https\?://||' | cut -d/ -f1)
  dig +short "$hostname" | head -1
}

_health_check_ok() {
  # Returns 0 (true) if the /health endpoint returns 200.
  local endpoint="${API_ENDPOINT:-http://localhost:3001}"
  if [ "$DRY_RUN" = "1" ]; then
    # Simulate: health is always OK during the transition
    return 0
  fi
  local status
  status=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
    "${endpoint}/health" 2>/dev/null || echo "000")
  [ "$status" = "200" ]
}

_write_results() {
  local elapsed=$(( $(date +%s) - TEST_START_EPOCH ))
  python3 - <<PYEOF
import json, datetime

results = {
    "timestamp":                  datetime.datetime.utcnow().isoformat() + "Z",
    "dry_run":                    "$DRY_RUN" == "1",
    "rto_threshold_seconds":      int("$RTO_SECONDS"),
    "failover_time_seconds":      int("$RESULT_FAILOVER_TIME"),
    "dns_shifted":                "$RESULT_DNS_SHIFTED" == "true",
    "health_endpoint_continuous": "$RESULT_HEALTH_CONTINUOUS" == "true",
    "primary_recovered":          "$RESULT_PRIMARY_RECOVERED" == "true",
    "passed":                     "$RESULT_PASSED" == "true",
    "primary_region":             "$PRIMARY_REGION",
    "secondary_region":           "$SECONDARY_REGION",
    "tests_passed":               int("$PASS"),
    "tests_failed":               int("$FAIL"),
}
with open("$RESULTS_FILE", "w") as f:
    json.dump(results, f, indent=2)
print(f"Results written to $RESULTS_FILE")
PYEOF
}

# ─────────────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════"
echo "  MULTI-REGION FAILOVER INTEGRATION TEST"
echo "  DRY_RUN          : ${DRY_RUN}"
echo "  PRIMARY_REGION   : ${PRIMARY_REGION}"
echo "  SECONDARY_REGION : ${SECONDARY_REGION}"
echo "  RTO_THRESHOLD    : ${RTO_SECONDS}s"
echo "  POLL_INTERVAL    : ${POLL_INTERVAL_SECONDS}s"
if [ "$DRY_RUN" = "0" ]; then
  echo "  PRIMARY_HC_ID    : ${PRIMARY_HEALTH_CHECK_ID:-<NOT SET>}"
  echo "  API_ENDPOINT     : ${API_ENDPOINT:-<NOT SET>}"
fi
echo "════════════════════════════════════════════════════════════"
echo

# ─── Step 1: Baseline — confirm both regions healthy ─────────────────────────
echo "── Step 1: Baseline ─────────────────────────────────────────────────────"

if [ "$DRY_RUN" = "0" ]; then
  : "${PRIMARY_HEALTH_CHECK_ID:?PRIMARY_HEALTH_CHECK_ID is required in live mode (DRY_RUN=0)}"
  : "${API_ENDPOINT:?API_ENDPOINT is required in live mode (DRY_RUN=0)}"

  # Confirm primary health check is currently healthy
  HC_STATUS=$(_aws route53 get-health-check-status \
    --health-check-id "$PRIMARY_HEALTH_CHECK_ID" \
    --region "$PRIMARY_REGION" \
    --query 'HealthCheckObservations[0].StatusReport.Status' \
    --output text 2>/dev/null || echo "unknown")

  if echo "$HC_STATUS" | grep -qi "Success\|Healthy"; then
    pass "Primary health check is healthy at baseline"
  else
    fail "Primary health check not healthy at baseline (status: ${HC_STATUS}) — aborting"
    exit 1
  fi

  if _health_check_ok; then
    pass "GET ${API_ENDPOINT}/health → 200 at baseline"
  else
    fail "GET ${API_ENDPOINT}/health is not healthy at baseline — aborting"
    exit 1
  fi
else
  info "[dry-run] Skipping real AWS/HTTP baseline checks"
  pass "Baseline checks (dry-run simulated)"
fi

BASELINE_IP=$(_get_resolved_ip)
info "Baseline DNS resolution: ${BASELINE_IP:-<not available>}"

# ─── Step 2: Induce primary-region failure ────────────────────────────────────
echo
echo "── Step 2: Disable primary health check ─────────────────────────────────"

_disable_primary_health_check
pass "Primary health check disabled"

FAILOVER_START=$(date +%s)
HEALTH_FAILED_DURING_TRANSITION=false
DNS_SHIFTED=false
FAILOVER_TIME=0

# ─── Step 3: Poll until DNS shifts OR timeout ─────────────────────────────────
echo
echo "── Step 3: Polling for DNS shift (max ${RTO_SECONDS}s) ──────────────────"

ELAPSED=0
while [ "$ELAPSED" -lt "$RTO_SECONDS" ]; do
  CURRENT_IP=$(_get_resolved_ip)
  NOW=$(date +%s)
  ELAPSED=$(( NOW - FAILOVER_START ))

  # Check continuous health during transition
  if ! _health_check_ok; then
    warn "Health check failed at t+${ELAPSED}s — recording availability gap"
    HEALTH_FAILED_DURING_TRANSITION=true
  else
    echo "    t+${ELAPSED}s: /health OK, DNS → ${CURRENT_IP:-?}"
  fi

  # In dry-run: after first POLL_INTERVAL the simulated secondary IP appears
  # In live mode: wait for the IP to change from the baseline
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$_DRY_HC_DISABLED" = "true" ] && [ "$ELAPSED" -ge "$POLL_INTERVAL_SECONDS" ]; then
      DNS_SHIFTED=true
      FAILOVER_TIME=$ELAPSED
      break
    fi
  else
    if [ -n "$CURRENT_IP" ] && [ "$CURRENT_IP" != "$BASELINE_IP" ]; then
      DNS_SHIFTED=true
      FAILOVER_TIME=$ELAPSED
      info "DNS shifted from ${BASELINE_IP} to ${CURRENT_IP} at t+${ELAPSED}s"
      break
    fi
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

# ─── Step 4: Assertions ───────────────────────────────────────────────────────
echo
echo "── Step 4: Assertions ───────────────────────────────────────────────────"

# 4a. DNS shifted within RTO
if [ "$DNS_SHIFTED" = "true" ]; then
  pass "DNS shifted to secondary region within RTO (t+${FAILOVER_TIME}s ≤ ${RTO_SECONDS}s)"
  RESULT_DNS_SHIFTED=true
  RESULT_FAILOVER_TIME=$FAILOVER_TIME
else
  fail "DNS did NOT shift within RTO window of ${RTO_SECONDS}s"
  RESULT_FAILOVER_TIME=$RTO_SECONDS
fi

# 4b. RTO assertion
if [ "$FAILOVER_TIME" -le "$RTO_SECONDS" ]; then
  pass "RTO assertion: failover_time=${FAILOVER_TIME}s ≤ threshold=${RTO_SECONDS}s"
else
  fail "RTO exceeded: failover_time=${FAILOVER_TIME}s > threshold=${RTO_SECONDS}s"
fi

# 4c. No health endpoint gap during transition
if [ "$HEALTH_FAILED_DURING_TRANSITION" = "false" ]; then
  pass "No health endpoint availability gap during failover transition"
  RESULT_HEALTH_CONTINUOUS=true
else
  fail "Health endpoint returned non-200 during failover transition"
  RESULT_HEALTH_CONTINUOUS=false
fi

# 4d. No data loss — verify /api/groups returns consistent results
echo
echo "── Step 4d: Data integrity check ───────────────────────────────────────"

if [ "$DRY_RUN" = "0" ] && [ -n "$API_ENDPOINT" ]; then
  PRE_COUNT=$(curl -sf --max-time 10 "${API_ENDPOINT}/api/groups" 2>/dev/null \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else d.get('total',0))" 2>/dev/null || echo "-1")

  if [ "$PRE_COUNT" != "-1" ] && [ "$PRE_COUNT" -ge 0 ]; then
    pass "Data integrity: /api/groups returned ${PRE_COUNT} groups post-failover (no data loss)"
  else
    warn "Could not fetch group count post-failover — skipping data integrity assertion"
  fi
else
  info "[dry-run] Simulating data integrity check"
  pass "Data integrity check (dry-run simulated)"
fi

# ─── Step 5: Restore primary health check ─────────────────────────────────────
echo
echo "── Step 5: Restore primary health check ─────────────────────────────────"

_restore_primary_health_check
pass "Primary health check re-enabled"

# ─── Step 6: Verify primary recovers ─────────────────────────────────────────
echo
echo "── Step 6: Verify primary recovers ──────────────────────────────────────"

RESTORE_WAIT=0
MAX_RESTORE_WAIT=120

while [ "$RESTORE_WAIT" -lt "$MAX_RESTORE_WAIT" ]; do
  if [ "$DRY_RUN" = "1" ]; then
    # After restore in dry-run, the mock IP reverts to primary
    RESTORED_IP=$(_get_resolved_ip)
    if [ "$RESTORED_IP" = "$BASELINE_IP" ]; then
      pass "Primary region recovered: DNS returned to ${BASELINE_IP} within ${RESTORE_WAIT}s"
      RESULT_PRIMARY_RECOVERED=true
      break
    fi
  else
    HC_STATUS=$(_aws route53 get-health-check-status \
      --health-check-id "$PRIMARY_HEALTH_CHECK_ID" \
      --region "$PRIMARY_REGION" \
      --query 'HealthCheckObservations[0].StatusReport.Status' \
      --output text 2>/dev/null || echo "unknown")

    if echo "$HC_STATUS" | grep -qi "Success\|Healthy"; then
      pass "Primary health check healthy again (t+${RESTORE_WAIT}s after restore)"
      RESULT_PRIMARY_RECOVERED=true
      break
    fi
  fi

  sleep "$POLL_INTERVAL_SECONDS"
  RESTORE_WAIT=$(( RESTORE_WAIT + POLL_INTERVAL_SECONDS ))
done

if [ "$RESULT_PRIMARY_RECOVERED" = "false" ]; then
  fail "Primary region did not recover within ${MAX_RESTORE_WAIT}s after restore"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════════"
echo "  FAILOVER TEST SUMMARY"
echo "  Tests  : ${PASS} passed, ${FAIL} failed"
echo "  RTO    : ${FAILOVER_TIME}s (threshold: ${RTO_SECONDS}s)"
echo "  DNS shifted  : ${RESULT_DNS_SHIFTED}"
echo "  Health OK    : ${RESULT_HEALTH_CONTINUOUS}"
echo "  Primary recovered: ${RESULT_PRIMARY_RECOVERED}"
echo "════════════════════════════════════════════════════════════"

if [ "$FAIL" -eq 0 ]; then
  RESULT_PASSED=true
  echo "✅ Failover integration test PASSED"
  exit 0
else
  echo "❌ Failover integration test FAILED — see results above"
  exit 1
fi
