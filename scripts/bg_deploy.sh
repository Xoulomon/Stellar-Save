#!/usr/bin/env bash
# scripts/bg_deploy.sh
# Deploys the frontend build to the inactive blue/green slot.
#
# Required env vars:
#   TARGET_SLOT   — blue | green
#   BUILD_HASH    — content hash of the build
#   DEPLOY_ENV    — staging | production
#   DEPLOY_HOST   — base URL of the deployment host (e.g. https://example.com)
#   DEPLOY_TOKEN  — auth token for the deployment API / SSH key path
#
# The script is intentionally host-agnostic: it calls a deploy hook that you
# configure per environment. Replace the "Deploy to slot" section with your
# actual hosting provider commands (S3 sync, rsync, Netlify CLI, etc.).
set -euo pipefail

: "${TARGET_SLOT:?}"
: "${BUILD_HASH:?}"
: "${DEPLOY_ENV:?}"
: "${DEPLOY_HOST:?}"

DIST_DIR="${DIST_DIR:-dist}"
# Allow override for testing; default resolves relative to repo root
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="${BG_REGISTRY:-${REPO_ROOT}/deployment-records/frontend-active.json}"
REGISTRY_DIR="$(dirname "$REGISTRY")"

mkdir -p "$REGISTRY_DIR"

echo "════════════════════════════════════════"
echo "  BG DEPLOY — slot: ${TARGET_SLOT}"
echo "  env: ${DEPLOY_ENV}  hash: ${BUILD_HASH}"
echo "════════════════════════════════════════"

# ─── Validate slot ────────────────────────────────────────────────────────────
if [[ "$TARGET_SLOT" != "blue" && "$TARGET_SLOT" != "green" ]]; then
  echo "❌ Invalid TARGET_SLOT '${TARGET_SLOT}'. Must be 'blue' or 'green'." >&2
  exit 1
fi

# ─── Ensure build artefact exists ────────────────────────────────────────────
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Build directory '${DIST_DIR}' not found." >&2
  exit 1
fi

# ─── Deploy to slot ──────────────────────────────────────────────────────────
# Replace this block with your actual hosting commands, e.g.:
#   aws s3 sync "$DIST_DIR/" "s3://my-bucket/${DEPLOY_ENV}-${TARGET_SLOT}/" --delete
#   netlify deploy --dir="$DIST_DIR" --alias="${DEPLOY_ENV}-${TARGET_SLOT}"
#   rsync -az "$DIST_DIR/" "user@host:/var/www/${DEPLOY_ENV}/${TARGET_SLOT}/"
echo "── Uploading build to ${TARGET_SLOT} slot ────────────────────────────────"
echo "   Source : ${DIST_DIR}/"
echo "   Target : ${DEPLOY_HOST}/${DEPLOY_ENV}/${TARGET_SLOT}/"

# Example: generic HTTP deploy hook (replace with real provider)
# curl -fsSL -X POST "${DEPLOY_HOST}/deploy" \
#   -H "Authorization: Bearer ${DEPLOY_TOKEN}" \
#   -H "Content-Type: application/json" \
#   -d "{\"slot\":\"${TARGET_SLOT}\",\"env\":\"${DEPLOY_ENV}\",\"hash\":\"${BUILD_HASH}\"}"

echo "✅ Build uploaded to ${TARGET_SLOT} slot"

# ─── Update registry (slot is deployed but NOT live yet) ─────────────────────
python3 - <<EOF
import json, datetime, os

registry = "$REGISTRY"
try:
    with open(registry) as f:
        data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    data = {}

slot = "$TARGET_SLOT"
data[f"{slot}_build_hash"] = "$BUILD_HASH"
data[f"{slot}_deployed_at"] = datetime.datetime.utcnow().isoformat() + "Z"
data[f"{slot}_commit"] = os.environ.get("COMMIT_SHA", "unknown")
data["environment"] = "$DEPLOY_ENV"

with open(registry, "w") as f:
    json.dump(data, f, indent=2)
print(json.dumps(data, indent=2))
EOF

echo
echo "════════════════════════════════════════"
echo "  ✅ Deployed to ${TARGET_SLOT} (not live yet)"
echo "     Run bg_health_check.sh then bg_switch.sh"
echo "════════════════════════════════════════"
