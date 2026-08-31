#!/usr/bin/env bash
# scripts/bg_rollback.sh
# Instantly rolls back to the previous slot by switching the live pointer.
# The previous slot's build is already deployed and warm — rollback is instant.
#
# Required env vars:
#   DEPLOY_ENV    — staging | production
#   DEPLOY_HOST   — base URL
#   DEPLOY_TOKEN  — auth token for the hosting API
#
# Optional:
#   ROLLBACK_REASON — reason string logged to the registry
set -euo pipefail

: "${DEPLOY_ENV:?}"
: "${DEPLOY_HOST:?}"

ROLLBACK_REASON="${ROLLBACK_REASON:-manual_rollback}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${BG_REGISTRY:-${REPO_ROOT}/deployment-records/frontend-active.json}"

echo "════════════════════════════════════════"
echo "  BG ROLLBACK"
echo "  reason: ${ROLLBACK_REASON}"
echo "  env: ${DEPLOY_ENV}"
echo "════════════════════════════════════════"

# ─── Read registry ────────────────────────────────────────────────────────────
if [ ! -f "$REGISTRY" ]; then
  echo "❌ No deployment registry found at ${REGISTRY}. Cannot rollback." >&2
  exit 1
fi

LIVE_SLOT=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d.get('live_slot',''))")
PREV_SLOT=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d.get('previous_slot',''))")

if [ -z "$PREV_SLOT" ] || [ "$PREV_SLOT" = "unknown" ]; then
  echo "❌ No previous slot recorded in registry. Cannot rollback." >&2
  exit 1
fi

if [ "$LIVE_SLOT" = "$PREV_SLOT" ]; then
  echo "⚠️  Live slot and previous slot are both '${LIVE_SLOT}'. Nothing to rollback to." >&2
  exit 1
fi

echo "  Current live : ${LIVE_SLOT}"
echo "  Rolling back : ${PREV_SLOT}"

# ─── Switch back to previous slot ────────────────────────────────────────────
# Replace with your actual routing command (same as bg_switch.sh)
echo "── Switching router back to ${PREV_SLOT} ────────────────────────────────"

# Example: generic HTTP switch hook
# curl -fsSL -X POST "${DEPLOY_HOST}/switch" \
#   -H "Authorization: Bearer ${DEPLOY_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d "{\"slot\":\"${PREV_SLOT}\",\"env\":\"${DEPLOY_ENV}\"}"

echo "✅ Router reverted to ${PREV_SLOT}"

# ─── Update registry ─────────────────────────────────────────────────────────
python3 - <<EOF
import json, datetime

registry = "$REGISTRY"
with open(registry) as f:
    data = json.load(f)

data["live_slot"] = "$PREV_SLOT"
data["previous_slot"] = "$LIVE_SLOT"
data["rolled_back_at"] = datetime.datetime.utcnow().isoformat() + "Z"
data["rollback_reason"] = "$ROLLBACK_REASON"
data["environment"] = "$DEPLOY_ENV"

with open(registry, "w") as f:
    json.dump(data, f, indent=2)
print(json.dumps(data, indent=2))
EOF

echo
echo "════════════════════════════════════════"
echo "  ✅ Rolled back to: ${PREV_SLOT}"
echo "     Reason: ${ROLLBACK_REASON}"
echo "════════════════════════════════════════"
