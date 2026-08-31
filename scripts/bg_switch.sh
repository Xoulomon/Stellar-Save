#!/usr/bin/env bash
# scripts/bg_switch.sh
# Atomically switches live traffic from the current slot to TARGET_SLOT.
# Updates deployment-records/frontend-active.json.
#
# Required env vars:
#   TARGET_SLOT   — blue | green  (the slot to make live)
#   DEPLOY_ENV    — staging | production
#   DEPLOY_HOST   — base URL
#   DEPLOY_TOKEN  — auth token for the hosting API
#
# If TARGET_SLOT is not set, the script reads the registry and switches to
# whichever slot is currently inactive (toggle behaviour).
set -euo pipefail

: "${DEPLOY_ENV:?}"
: "${DEPLOY_HOST:?}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${BG_REGISTRY:-${REPO_ROOT}/deployment-records/frontend-active.json}"
REGISTRY_DIR="$(dirname "$REGISTRY")"

mkdir -p "$REGISTRY_DIR"

# ─── Determine target slot ────────────────────────────────────────────────────
if [ -z "${TARGET_SLOT:-}" ]; then
  if [ -f "$REGISTRY" ]; then
    LIVE=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d.get('live_slot','blue'))")
    TARGET_SLOT=$( [ "$LIVE" = "blue" ] && echo "green" || echo "blue" )
  else
    TARGET_SLOT="blue"
  fi
fi

if [[ "$TARGET_SLOT" != "blue" && "$TARGET_SLOT" != "green" ]]; then
  echo "❌ Invalid TARGET_SLOT '${TARGET_SLOT}'." >&2
  exit 1
fi

# ─── Read current live slot ───────────────────────────────────────────────────
CURRENT_SLOT="unknown"
if [ -f "$REGISTRY" ]; then
  CURRENT_SLOT=$(python3 -c "import json; d=json.load(open('$REGISTRY')); print(d.get('live_slot','unknown'))")
fi

echo "════════════════════════════════════════"
echo "  BG SWITCH"
echo "  ${CURRENT_SLOT} → ${TARGET_SLOT}"
echo "  env: ${DEPLOY_ENV}"
echo "════════════════════════════════════════"

if [ "$CURRENT_SLOT" = "$TARGET_SLOT" ]; then
  echo "⚠️  Target slot '${TARGET_SLOT}' is already live. Nothing to do."
  exit 0
fi

# ─── Perform the switch ───────────────────────────────────────────────────────
# Replace this block with your actual routing switch, e.g.:
#   aws cloudfront update-distribution ...
#   netlify alias set "${DEPLOY_ENV}" "${TARGET_SLOT}"
#   kubectl patch ingress frontend --patch '{"spec":{"rules":[...]}}'
echo "── Switching router to ${TARGET_SLOT} slot ───────────────────────────────"
echo "   Host  : ${DEPLOY_HOST}"
echo "   Slot  : ${TARGET_SLOT}"

# Example: generic HTTP switch hook
# curl -fsSL -X POST "${DEPLOY_HOST}/switch" \
#   -H "Authorization: Bearer ${DEPLOY_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d "{\"slot\":\"${TARGET_SLOT}\",\"env\":\"${DEPLOY_ENV}\"}"

echo "✅ Router updated"

# ─── Update registry ─────────────────────────────────────────────────────────
python3 - <<EOF
import json, datetime

registry = "$REGISTRY"
try:
    with open(registry) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {}

data["previous_slot"] = data.get("live_slot", "unknown")
data["live_slot"] = "$TARGET_SLOT"
data["switched_at"] = datetime.datetime.utcnow().isoformat() + "Z"
data["environment"] = "$DEPLOY_ENV"

with open(registry, "w") as f:
    json.dump(data, f, indent=2)
print(json.dumps(data, indent=2))
EOF

echo
echo "════════════════════════════════════════"
echo "  ✅ Live slot is now: ${TARGET_SLOT}"
echo "     Previous slot (${CURRENT_SLOT}) is on standby for rollback"
echo "════════════════════════════════════════"
