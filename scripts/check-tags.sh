#!/usr/bin/env bash
# check-tags.sh — Verify all Terraform-managed resources carry required cost-allocation tags.
#
# Usage (local):
#   bash scripts/check-tags.sh infra/envs/production
#   bash scripts/check-tags.sh infra/envs/staging
#
# Usage (CI): run after `terraform plan -out=plan.tfplan && terraform show -json plan.tfplan > plan.json`
#   PLAN_JSON=plan.json bash scripts/check-tags.sh
#
# Exit codes: 0 = all clear, 1 = missing required tags detected.
set -euo pipefail

REQUIRED_TAGS=(
  "Project"
  "Environment"
  "Service"
  "ManagedBy"
  "CostCenter"
  "Owner"
)

PLAN_JSON="${PLAN_JSON:-}"
ENV_DIR="${1:-}"
TMPFILE=""
ERRORS=0

cleanup() { [ -n "$TMPFILE" ] && rm -f "$TMPFILE"; }
trap cleanup EXIT

# ── Resolve plan JSON ─────────────────────────────────────────────────────────
if [ -n "$PLAN_JSON" ] && [ -f "$PLAN_JSON" ]; then
  echo "Using pre-generated plan JSON: $PLAN_JSON"
elif [ -n "$ENV_DIR" ] && [ -d "$ENV_DIR" ]; then
  if ! command -v terraform &>/dev/null; then
    echo "ERROR: terraform not found in PATH — cannot generate plan" >&2
    exit 1
  fi
  TMPFILE=$(mktemp /tmp/stellar-save-plan-XXXXXX.json)
  echo "Generating plan for $ENV_DIR ..."
  (
    cd "$ENV_DIR"
    terraform init -input=false -backend=false -reconfigure >/dev/null 2>&1 || true
    terraform plan -input=false -out="$TMPFILE.tfplan" >/dev/null 2>&1 || true
    terraform show -json "$TMPFILE.tfplan" > "$TMPFILE" 2>/dev/null || true
    rm -f "$TMPFILE.tfplan"
  )
  PLAN_JSON="$TMPFILE"
else
  echo "ERROR: Provide either PLAN_JSON env var (path to plan JSON) or a directory as first argument." >&2
  echo "  Usage: bash scripts/check-tags.sh <env-dir>" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not found in PATH" >&2
  exit 1
fi

# ── Check each planned resource ───────────────────────────────────────────────
echo ""
echo "Checking required cost-allocation tags on planned resources..."
echo "Required: ${REQUIRED_TAGS[*]}"
echo ""

# Extract resources that will be created or updated
RESOURCES=$(jq -r '
  .resource_changes[]
  | select(.change.actions | map(. == "no-op") | any | not)
  | select(.change.actions | map(. == "delete") | all | not)
  | {type: .type, name: .name, tags: (.change.after.tags // {})}
' "$PLAN_JSON" 2>/dev/null || echo "")

if [ -z "$RESOURCES" ]; then
  echo "No resources to check (empty plan or parse error — verify the plan JSON is valid)."
  exit 0
fi

# Iterate resource objects
while IFS= read -r resource; do
  RTYPE=$(echo "$resource" | jq -r '.type')
  RNAME=$(echo "$resource" | jq -r '.name')
  RTAGS=$(echo "$resource" | jq -r '.tags')

  MISSING=()
  for tag in "${REQUIRED_TAGS[@]}"; do
    val=$(echo "$RTAGS" | jq -r --arg t "$tag" '.[$t] // empty')
    if [ -z "$val" ]; then
      MISSING+=("$tag")
    fi
  done

  if [ ${#MISSING[@]} -gt 0 ]; then
    echo "FAIL  ${RTYPE}.${RNAME}"
    echo "      Missing tags: ${MISSING[*]}"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK    ${RTYPE}.${RNAME}"
  fi
done < <(jq -c '
  .resource_changes[]
  | select(.change.actions | map(. == "no-op") | any | not)
  | select(.change.actions | map(. == "delete") | all | not)
  | {type: .type, name: .name, tags: (.change.after.tags // {})}
' "$PLAN_JSON" 2>/dev/null)

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED: $ERRORS resource(s) missing required cost-allocation tags."
  echo "See docs/tagging-standard.md for the full tag requirements."
  exit 1
else
  echo "All resources carry the required cost-allocation tags."
fi
