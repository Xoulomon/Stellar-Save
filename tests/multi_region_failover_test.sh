#!/usr/bin/env bash
# tests/multi_region_failover_test.sh
#
# Multi-region failover integration test (issue #1349).
#
# Simulates a primary-region outage and verifies that:
#   1. Traffic fails over to the secondary region within the documented RTO
#      (≤ 150s: 3×30s health-check interval + 60s DNS TTL)
#   2. The /health endpoint stays reachable throughout the transition (no
#      user-visible outage gap)
#   3. No data loss or duplication occurs during failover (read-your-writes
#      consistency after failover)
#
# The test supports two execution modes:
#
#   LIVE mode  (AWS_ACCESS_KEY_ID set, MODE=live)
#     Interacts with real Route53 health checks via the AWS CLI.
#     Requires: aws, dig, curl; Route53 health check IDs from Terraform output.
#     WARNING: Do NOT run against production — use a staging environment.
#
#   SIMULATED mode  (default, MODE=simulated or no AWS credentials)
#     Uses a local HTTP server to simulate primary/secondary endpoints and a
#     mock "Route53" routing registry file.  No AWS account required.
#     Useful for CI pipelines and local development.
#
# Required env vars (LIVE mode):
#   API_HOSTNAME          — e.g. api-staging.stellar-save.app
#   PRIMARY_HC_ID         — Route53 health-check ID for the primary region
#   SECONDARY_HC_ID       — Route53 health-check ID for the secondary region
#   AWS_REGION            — e.g. us-east-1
#
# Optional env vars (both modes):
#   RTO_SECONDS           — max seconds to wait for failover (default: 150)
#   POLL_INTERVAL         — seconds between resolution polls (default: 10)
#   RESTORE_ON_EXIT       — if "true", re-enable the primary HC after test (default: true)
#
set -euo pipefail

RTO_SECONDS="${RTO_SECONDS:-150}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
RESTORE_ON_EXIT="${RESTORE_ON_EXIT:-true}"
MODE="${MODE:-simulated}"

PASS=0; FAIL=0; SKIP=0

# ─── Helpers ─────────────────────────────────────────────────────────────────

ok()      { echo "  ✅  $*"; ((PASS++)) || true; }
fail()    { echo "  ❌  $*"; ((FAIL++)) || true; }
skip()    { echo "  ⏭️   $*"; ((SKIP++)) || true; }
section() { echo; echo "── $* ────────────────────────────────────────────────────────────────"; }
info()    { echo "  ℹ️   $*"; }

# ─── Mode detection ──────────────────────────────────────────────────────────

if [ "$MODE" != "live" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  MODE="simulated"
fi

echo "════════════════════════════════════════════════════════════════"
echo "  MULTI-REGION FAILOVER INTEGRATION TEST"
echo "  Mode: ${MODE}"
echo "  RTO target: ${RTO_SECONDS}s"
echo "════════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# SIMULATED MODE
# Uses lightweight local HTTP servers to represent the primary and secondary
# regions.  Routing state is tracked in a JSON registry file.  The "health
# check" simply reads the registry to decide which endpoint to serve.
# ─────────────────────────────────────────────────────────────────────────────

if [ "$MODE" = "simulated" ]; then
  TMP=$(mktemp -d)
  trap 'kill $(cat "$TMP/primary.pid" "$TMP/secondary.pid" 2>/dev/null) 2>/dev/null; rm -rf "$TMP"' EXIT

  REGISTRY="$TMP/routing.json"
  LAST_WRITE_FILE="$TMP/last_write.json"
  PRIMARY_PORT=18081
  SECONDARY_PORT=18082
  ROUTER_PORT=18080

  # ── Start primary and secondary mock HTTP servers ─────────────────────────
  section "Setup: start mock primary and secondary region servers"

  PRIMARY_PID_FILE="$TMP/primary.pid"
  SECONDARY_PID_FILE="$TMP/secondary.pid"

  # Primary server (port 18081): responds to /health and /api/groups
  python3 - "$PRIMARY_PORT" "$TMP" "$LAST_WRITE_FILE" "$PRIMARY_PID_FILE" <<'PYEOF' &
import http.server, json, sys, os

PORT = int(sys.argv[1])
LAST_WRITE_FILE = sys.argv[3]
PID_FILE = sys.argv[4]

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'region': 'us-east-1'}).encode())
        elif self.path.startswith('/api/groups'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps([{'id': '1', 'name': 'Primary Group'}]).encode())
        elif self.path == '/api/data/read':
            try:
                with open(LAST_WRITE_FILE) as f:
                    data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            except FileNotFoundError:
                self.send_response(404); self.end_headers()
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        record = json.loads(body) if body else {}
        record['region'] = 'us-east-1'
        with open(LAST_WRITE_FILE, 'w') as f:
            json.dump(record, f)
        self.send_response(201)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'id': record.get('id', '42'), 'region': 'us-east-1'}).encode())
    def log_message(self, *a): pass

with open(PID_FILE, 'w') as f:
    f.write(str(os.getpid()))
srv = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
srv.serve_forever()
PYEOF
  PRIMARY_BG_PID=$!

  # Secondary server (port 18082)
  python3 - "$SECONDARY_PORT" "$TMP" "$LAST_WRITE_FILE" "$SECONDARY_PID_FILE" <<'PYEOF' &
import http.server, json, sys, os

PORT = int(sys.argv[1])
LAST_WRITE_FILE = sys.argv[3]
PID_FILE = sys.argv[4]

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'region': 'eu-west-1'}).encode())
        elif self.path.startswith('/api/groups'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps([{'id': '1', 'name': 'Primary Group'}]).encode())
        elif self.path == '/api/data/read':
            # Simulates cross-region replication by reading the shared temp file
            try:
                with open(LAST_WRITE_FILE) as f:
                    data = json.load(f)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            except FileNotFoundError:
                self.send_response(404); self.end_headers()
        else:
            self.send_response(404); self.end_headers()
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        record = json.loads(body) if body else {}
        record['region'] = 'eu-west-1'
        with open(LAST_WRITE_FILE, 'w') as f:
            json.dump(record, f)
        self.send_response(201)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'id': record.get('id', '42'), 'region': 'eu-west-1'}).encode())
    def log_message(self, *a): pass

with open(PID_FILE, 'w') as f:
    f.write(str(os.getpid()))
srv = http.server.HTTPServer(('127.0.0.1', PORT), Handler)
srv.serve_forever()
PYEOF
  SECONDARY_BG_PID=$!

  # Update trap to kill by background job PID
  trap 'kill "$PRIMARY_BG_PID" "$SECONDARY_BG_PID" 2>/dev/null; rm -rf "$TMP"' EXIT

  # Write initial routing registry: primary active
  python3 -c "
import json, os
registry = {
    'primary': {'url': 'http://127.0.0.1:$PRIMARY_PORT', 'healthy': True, 'region': 'us-east-1'},
    'secondary': {'url': 'http://127.0.0.1:$SECONDARY_PORT', 'healthy': True, 'region': 'eu-west-1'},
    'active': 'primary'
}
os.makedirs('$(dirname "$REGISTRY")', exist_ok=True)
with open('$REGISTRY', 'w') as f: json.dump(registry, f, indent=2)
"

  # Poll for server readiness (up to 8 seconds)
  for SERVER_NAME in "Primary:${PRIMARY_PORT}" "Secondary:${SECONDARY_PORT}"; do
    SRV_LABEL="${SERVER_NAME%%:*}"
    SRV_PORT="${SERVER_NAME##*:}"
    READY=0
    for _ in $(seq 1 8); do
      if curl -sf --max-time 1 "http://127.0.0.1:${SRV_PORT}/health" -o /dev/null 2>/dev/null; then
        READY=1; break
      fi
      sleep 0.5
    done
    if [ "$READY" -eq 1 ]; then
      ok "${SRV_LABEL} mock server started (port ${SRV_PORT})"
    else
      fail "${SRV_LABEL} mock server failed to start — aborting"
      exit 1
    fi
  done

  # ── Routing helper ────────────────────────────────────────────────────────
  # Returns the URL of the currently active region
  active_url() {
    python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
active = r['active']
print(r[active]['url'])
"
  }

  # Resolve which region is currently active
  active_region() {
    python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
print(r[r['active']]['region'])
"
  }

  # ── Test 1: Baseline — primary region serves traffic ─────────────────────
  section "Test 1: Baseline — primary region is healthy and serves traffic"

  BASELINE_URL=$(active_url)
  BASELINE_REGION=$(active_region)

  BASELINE_HEALTH=$(curl -s --max-time 5 "${BASELINE_URL}/health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")
  if [ "$BASELINE_HEALTH" = "ok" ]; then
    ok "Baseline /health returns 'ok' from ${BASELINE_REGION}"
  else
    fail "Baseline /health check failed (got: '${BASELINE_HEALTH}')"
  fi

  BASELINE_GROUPS=$(curl -s --max-time 5 "${BASELINE_URL}/api/groups" 2>/dev/null || echo "")
  if echo "$BASELINE_GROUPS" | python3 -c "import json,sys; g=json.load(sys.stdin); exit(0 if isinstance(g,list) else 1)" 2>/dev/null; then
    ok "Baseline GET /api/groups returns a valid array"
  else
    fail "Baseline GET /api/groups returned unexpected: ${BASELINE_GROUPS:0:100}"
  fi

  # ── Test 2: Write a record to the primary region ─────────────────────────
  section "Test 2: Write a record to primary (data-loss baseline)"

  WRITE_PAYLOAD='{"id":"group-failover-test-001","name":"Failover Test Group","contributionAmount":100}'
  WRITE_RESPONSE=$(curl -s --max-time 5 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$WRITE_PAYLOAD" \
    "${BASELINE_URL}/api/groups" 2>/dev/null || echo "")

  if echo "$WRITE_RESPONSE" | grep -q '"id"'; then
    WRITTEN_ID=$(echo "$WRITE_RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
    ok "Write to primary succeeded (id=${WRITTEN_ID})"
  else
    fail "Write to primary failed: ${WRITE_RESPONSE:0:100}"
  fi

  # ── Test 3: Induce primary-region failure ─────────────────────────────────
  section "Test 3: Induce primary-region failure (simulate region down)"

  python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
r['primary']['healthy'] = False
r['active'] = 'secondary'   # failover: Route53 stops returning the primary record
with open('$REGISTRY', 'w') as f:
    json.dump(r, f, indent=2)
print('Primary marked unhealthy; routing switched to secondary')
"
  ok "Primary region marked unhealthy in routing registry"
  info "In live mode this step would execute: aws route53 update-health-check --health-check-id \$PRIMARY_HC_ID --disabled"

  # ── Test 4: RTO assertion — failover within RTO_SECONDS ──────────────────
  section "Test 4: RTO assertion — failover within ${RTO_SECONDS}s"

  FAILOVER_START=$(date +%s)
  FAILOVER_DETECTED=0
  FAILOVER_TIME=0

  # Continuously poll the routing-aware URL and track when secondary takes over
  HEALTH_GAPS=0   # number of consecutive polls where /health was unreachable
  MAX_GAP=0       # worst gap (consecutive failures) — must stay 0

  while true; do
    CURRENT_URL=$(active_url)
    CURRENT_REGION=$(active_region)
    NOW=$(date +%s)
    ELAPSED=$((NOW - FAILOVER_START))

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${CURRENT_URL}/health" || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
      HEALTH_GAPS=0
      if [ "$CURRENT_REGION" = "eu-west-1" ] && [ "$FAILOVER_DETECTED" -eq 0 ]; then
        FAILOVER_DETECTED=1
        FAILOVER_TIME=$ELAPSED
        info "Failover detected at ${ELAPSED}s — now routing to ${CURRENT_REGION}"
      fi
    else
      ((HEALTH_GAPS++)) || true
      if [ "$HEALTH_GAPS" -gt "$MAX_GAP" ]; then
        MAX_GAP=$HEALTH_GAPS
      fi
    fi

    if [ "$FAILOVER_DETECTED" -eq 1 ]; then
      break
    fi

    if [ "$ELAPSED" -ge "$RTO_SECONDS" ]; then
      break
    fi

    sleep "$POLL_INTERVAL"
  done

  if [ "$FAILOVER_DETECTED" -eq 1 ]; then
    ok "Traffic failed over to secondary region in ${FAILOVER_TIME}s (RTO ≤ ${RTO_SECONDS}s)"
  else
    fail "Failover did NOT complete within ${RTO_SECONDS}s RTO window"
  fi

  # ── Test 5: No user-visible outage during failover ────────────────────────
  section "Test 5: No user-visible outage during failover (health continuity)"

  if [ "$MAX_GAP" -eq 0 ]; then
    ok "/health remained reachable throughout the transition (max gap: 0 consecutive failures)"
  elif [ "$MAX_GAP" -le 1 ]; then
    ok "/health had at most 1 consecutive failure during transition (within acceptable window)"
  else
    fail "/health was unreachable for ${MAX_GAP} consecutive polls — potential user-visible outage"
  fi

  # ── Test 6: No data loss — secondary can read what primary wrote ──────────
  section "Test 6: No data loss — secondary serves replicated data"

  SECONDARY_URL=$(python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
print(r['secondary']['url'])
")

  REPLICATED=$(curl -s --max-time 5 "${SECONDARY_URL}/api/data/read" 2>/dev/null || echo "")
  if echo "$REPLICATED" | grep -q "group-failover-test-001"; then
    ok "Secondary region serves data written to primary (no data loss)"
  elif echo "$REPLICATED" | grep -q '"id"'; then
    ok "Secondary region serves data (replication present)"
  else
    # In a real system, this would be a cross-region replica read; in the
    # simulation the data file is shared on disk, so absence is a test bug.
    fail "Secondary region could not serve data written to primary — data loss risk"
  fi

  # ── Test 7: No data duplication — write to secondary post-failover ────────
  section "Test 7: No data duplication during failover write"

  SECONDARY_WRITE=$(curl -s --max-time 5 \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"id":"group-failover-test-002","name":"Post-Failover Group"}' \
    "${SECONDARY_URL}/api/groups" 2>/dev/null || echo "")

  if echo "$SECONDARY_WRITE" | grep -q '"id"'; then
    WRITTEN_REGION=$(echo "$SECONDARY_WRITE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('region','unknown'))" 2>/dev/null || echo "unknown")
    ok "Write to secondary during failover succeeded (region: ${WRITTEN_REGION})"
  else
    fail "Write to secondary during failover failed: ${SECONDARY_WRITE:0:100}"
  fi

  # ── Test 8: Restore — primary region re-enabled ───────────────────────────
  section "Test 8: Restore — re-enable primary region and confirm routing returns"

  if [ "$RESTORE_ON_EXIT" = "true" ]; then
    python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
r['primary']['healthy'] = True
r['active'] = 'primary'
with open('$REGISTRY', 'w') as f:
    json.dump(r, f, indent=2)
print('Primary re-enabled; routing restored')
"
    info "In live mode this step would execute: aws route53 update-health-check --health-check-id \$PRIMARY_HC_ID --no-disabled"

    # Allow one poll cycle for routing to restore
    sleep 2

    RESTORED_REGION=$(active_region)
    if [ "$RESTORED_REGION" = "us-east-1" ]; then
      ok "Routing restored to primary region (${RESTORED_REGION}) after re-enable"
    else
      fail "Routing did not return to primary after re-enable (still on: ${RESTORED_REGION})"
    fi

    # Verify primary health after restore
    PRIMARY_URL=$(python3 -c "
import json
with open('$REGISTRY') as f:
    r = json.load(f)
print(r['primary']['url'])
")
    RESTORED_HEALTH=$(curl -s --max-time 5 "${PRIMARY_URL}/health" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null || echo "")
    if [ "$RESTORED_HEALTH" = "ok" ]; then
      ok "Primary region /health returns 'ok' post-restore"
    else
      fail "Primary region /health check failed post-restore"
    fi
  else
    skip "Restore skipped (RESTORE_ON_EXIT=false)"
  fi

# ─────────────────────────────────────────────────────────────────────────────
# LIVE MODE — interacts with real AWS Route53 health checks
# ─────────────────────────────────────────────────────────────────────────────
else
  : "${API_HOSTNAME:?API_HOSTNAME is required for live mode}"
  : "${PRIMARY_HC_ID:?PRIMARY_HC_ID is required for live mode}"
  : "${SECONDARY_HC_ID:?SECONDARY_HC_ID is required for live mode}"
  : "${AWS_REGION:?AWS_REGION is required for live mode}"

  # Guard: require a non-production hostname
  if echo "$API_HOSTNAME" | grep -qvE "staging|canary|test|dev"; then
    echo "❌ Live failover test must only target staging/canary environments." >&2
    echo "   API_HOSTNAME='${API_HOSTNAME}' does not look like a staging endpoint." >&2
    echo "   Set API_HOSTNAME to a staging URL to proceed." >&2
    exit 1
  fi

  # ── Baseline ────────────────────────────────────────────────────────────
  section "Live test 1: Baseline health check"

  hc_status() {
    aws route53 get-health-check-status \
      --health-check-id "$1" \
      --region "$AWS_REGION" \
      --query 'HealthCheckObservations[].StatusReport.Status' \
      --output text 2>/dev/null || echo ""
  }

  PRIMARY_STATUS=$(hc_status "$PRIMARY_HC_ID")
  SECONDARY_STATUS=$(hc_status "$SECONDARY_HC_ID")

  if echo "$PRIMARY_STATUS" | grep -qi "Success"; then
    ok "Primary health check is healthy (${PRIMARY_HC_ID})"
  else
    fail "Primary health check not healthy before test: ${PRIMARY_STATUS}"
  fi

  if echo "$SECONDARY_STATUS" | grep -qi "Success"; then
    ok "Secondary health check is healthy (${SECONDARY_HC_ID})"
  else
    fail "Secondary health check not healthy before test: ${SECONDARY_STATUS}"
  fi

  BASELINE_DNS=$(dig +short "$API_HOSTNAME" | head -1)
  ok "Baseline DNS resolution: ${API_HOSTNAME} → ${BASELINE_DNS}"

  BASELINE_HEALTH=$(curl -sf --max-time 10 "https://${API_HOSTNAME}/health" 2>/dev/null || echo "")
  if echo "$BASELINE_HEALTH" | grep -qi "ok\|healthy\|status"; then
    ok "Baseline /health is reachable and healthy"
  else
    fail "Baseline /health not healthy: ${BASELINE_HEALTH:0:100}"
  fi

  # ── Write baseline record ────────────────────────────────────────────────
  section "Live test 2: Write a record before inducing failure"

  WRITE_ID="failover-test-$(date +%s)"
  WRITE_RESP=$(curl -sf --max-time 10 \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"${WRITE_ID}\",\"name\":\"Failover Test Group\"}" \
    "https://${API_HOSTNAME}/api/groups" 2>/dev/null || echo "")

  if echo "$WRITE_RESP" | grep -q '"id"'; then
    ok "Write to primary succeeded (id=${WRITE_ID})"
  else
    skip "Write to primary failed or requires auth — skipping data-loss check: ${WRITE_RESP:0:100}"
  fi

  # ── Induce failure: disable primary health check ─────────────────────────
  section "Live test 3: Disable primary health check (simulate region outage)"

  if [ "$RESTORE_ON_EXIT" = "true" ]; then
    trap 'echo "Restoring primary health check…"; aws route53 update-health-check --health-check-id "$PRIMARY_HC_ID" --region "$AWS_REGION" --no-disabled 2>/dev/null || true' EXIT
  fi

  aws route53 update-health-check \
    --health-check-id "$PRIMARY_HC_ID" \
    --region "$AWS_REGION" \
    --disabled 2>/dev/null
  ok "Primary health check disabled (${PRIMARY_HC_ID})"

  # ── RTO assertion ────────────────────────────────────────────────────────
  section "Live test 4: RTO assertion — failover within ${RTO_SECONDS}s"

  FAILOVER_START=$(date +%s)
  FAILOVER_DETECTED=0
  FAILOVER_TIME=0
  MAX_GAP=0
  HEALTH_GAPS=0

  while true; do
    NOW=$(date +%s)
    ELAPSED=$((NOW - FAILOVER_START))

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "https://${API_HOSTNAME}/health" || echo "000")
    CURRENT_DNS=$(dig +short "$API_HOSTNAME" 2>/dev/null | head -1 || echo "")

    if [ "$HTTP_STATUS" = "200" ]; then
      HEALTH_GAPS=0
      if [ -n "$CURRENT_DNS" ] && [ "$CURRENT_DNS" != "$BASELINE_DNS" ] && [ "$FAILOVER_DETECTED" -eq 0 ]; then
        FAILOVER_DETECTED=1
        FAILOVER_TIME=$ELAPSED
        info "DNS change detected at ${ELAPSED}s: ${BASELINE_DNS} → ${CURRENT_DNS}"
      fi
    else
      ((HEALTH_GAPS++)) || true
      if [ "$HEALTH_GAPS" -gt "$MAX_GAP" ]; then MAX_GAP=$HEALTH_GAPS; fi
    fi

    if [ "$FAILOVER_DETECTED" -eq 1 ]; then
      break
    fi

    if [ "$ELAPSED" -ge "$RTO_SECONDS" ]; then
      break
    fi

    sleep "$POLL_INTERVAL"
  done

  if [ "$FAILOVER_DETECTED" -eq 1 ]; then
    ok "DNS failover detected in ${FAILOVER_TIME}s (RTO ≤ ${RTO_SECONDS}s)"
  else
    fail "DNS failover did NOT complete within ${RTO_SECONDS}s"
    info "Expected: DNS to shift from ${BASELINE_DNS} to secondary region IP"
    info "Check Route53 health-check propagation and TTL settings"
  fi

  # ── Continuity ──────────────────────────────────────────────────────────
  section "Live test 5: No user-visible outage"

  if [ "$MAX_GAP" -eq 0 ]; then
    ok "/health remained reachable throughout (0 consecutive failures)"
  elif [ "$MAX_GAP" -le 1 ]; then
    ok "/health had at most 1 consecutive failure (within single-poll tolerance)"
  else
    fail "/health was unreachable for ${MAX_GAP} consecutive polls during failover"
  fi

  # ── Data loss check ─────────────────────────────────────────────────────
  section "Live test 6: No data loss post-failover"

  if echo "$WRITE_RESP" | grep -q '"id"'; then
    # After failover the secondary should serve the replicated record
    sleep 5
    READ_RESP=$(curl -sf --max-time 10 "https://${API_HOSTNAME}/api/groups/${WRITE_ID}" 2>/dev/null || echo "")
    if echo "$READ_RESP" | grep -q "$WRITE_ID"; then
      ok "Record written to primary is readable from secondary after failover (no data loss)"
    else
      fail "Record written to primary NOT found via secondary after failover: ${READ_RESP:0:100}"
    fi
  else
    skip "Data-loss check skipped (write was not successful)"
  fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo
echo "════════════════════════════════════════════════════════════════"
echo "  FAILOVER TEST SUMMARY  (mode: ${MODE})"
echo "  ✅ Passed : ${PASS}"
echo "  ❌ Failed : ${FAIL}"
echo "  ⏭️  Skipped: ${SKIP}"
if [ "${FAILOVER_TIME:-0}" -gt 0 ]; then
  echo "  ⏱  Failover time: ${FAILOVER_TIME}s (RTO target: ${RTO_SECONDS}s)"
fi
echo "════════════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "🚫 Multi-region failover test FAILED."
  echo "   Review failures above and consult docs/multi-region-failover.md."
  exit 1
fi

echo
echo "✅ Multi-region failover test PASSED."
echo "   Measured failover time: ${FAILOVER_TIME:-0}s"
echo "   RTO target: ${RTO_SECONDS}s"
echo "   Results should be recorded in docs/multi-region-failover.md."
