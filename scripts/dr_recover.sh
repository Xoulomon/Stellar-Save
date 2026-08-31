#!/usr/bin/env bash
# scripts/dr_recover.sh
# Automated disaster recovery entry point for Stellar-Save.
#
# Usage:
#   dr_recover.sh <command> [options]
#
# Commands:
#   contract-rollback  --run-id <github-run-id>   Roll back contract to a previous WASM
#   data-restore       --job-id <id> | --latest   Restore backend data from backup
#   pause-all-groups                               Pause every active group
#   unpause-all-groups                             Unpause every active group
#   health-check                                   Verify all systems are operational
#
# Required env vars (per command — see individual sections below):
#   STELLAR_NETWORK, STELLAR_RPC_URL, CONTRACT_ID, ADMIN_SECRET, BACKEND_URL
set -euo pipefail

COMMAND="${1:-}"
shift || true

# ── Defaults ──────────────────────────────────────────────────────────────────
STELLAR_NETWORK="${STELLAR_NETWORK:-testnet}"
STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
CONTRACT_ID="${CONTRACT_ID:-}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
REPO="${REPO:-Xoulomon/Stellar-Save}"
GH_TOKEN="${GH_TOKEN:-}"

OK="\033[32m✓\033[0m"
ERR="\033[31m✗\033[0m"
INFO="\033[36m→\033[0m"

log()  { echo -e "${INFO} $*"; }
ok()   { echo -e "${OK} $*"; }
fail() { echo -e "${ERR} $*" >&2; exit 1; }

# ── health-check ──────────────────────────────────────────────────────────────
cmd_health_check() {
  local exit_code=0

  log "Checking backend health..."
  if curl -sf "${BACKEND_URL}/api/v2/health" >/dev/null 2>&1; then
    ok "Backend reachable"
  else
    echo -e "${ERR} Backend unreachable at ${BACKEND_URL}" >&2
    exit_code=1
  fi

  log "Checking Stellar RPC..."
  if curl -sf "${STELLAR_RPC_URL}/health" >/dev/null 2>&1; then
    ok "Stellar RPC reachable"
  else
    echo -e "${ERR} Stellar RPC unreachable at ${STELLAR_RPC_URL}" >&2
    exit_code=1
  fi

  log "Checking backup status..."
  BACKUP_STATUS=$(curl -sf "${BACKEND_URL}/api/v1/backup/alerts" 2>/dev/null || echo "[]")
  OPEN_ALERTS=$(echo "$BACKUP_STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len([a for a in d if not a.get('acknowledged')]))" 2>/dev/null || echo "?")
  if [ "$OPEN_ALERTS" = "0" ]; then
    ok "No open backup alerts"
  else
    echo -e "${ERR} ${OPEN_ALERTS} open backup alert(s)" >&2
    exit_code=1
  fi

  return $exit_code
}

# ── pause-all-groups ──────────────────────────────────────────────────────────
cmd_pause_all_groups() {
  : "${CONTRACT_ID:?CONTRACT_ID required}"
  : "${ADMIN_SECRET:?ADMIN_SECRET required}"

  log "Fetching active group IDs..."
  # Query on-chain group count then iterate
  GROUP_COUNT=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$ADMIN_SECRET" \
    -- get_group_count 2>/dev/null || echo "0")

  if [ "$GROUP_COUNT" -eq 0 ]; then
    ok "No groups found — nothing to pause"
    return 0
  fi

  ADMIN_ADDRESS=$(stellar keys address "$(basename "$ADMIN_SECRET")" 2>/dev/null || echo "$ADMIN_SECRET")

  for i in $(seq 0 $(( GROUP_COUNT - 1 ))); do
    log "Pausing group ${i}..."
    stellar contract invoke \
      --id "$CONTRACT_ID" \
      --network "$STELLAR_NETWORK" \
      --rpc-url "$STELLAR_RPC_URL" \
      --source-account "$ADMIN_SECRET" \
      -- pause_group --group_id "$i" --caller "$ADMIN_ADDRESS" 2>/dev/null \
      && ok "Group ${i} paused" \
      || echo -e "${ERR} Failed to pause group ${i} (may already be paused)" >&2
  done
}

# ── unpause-all-groups ────────────────────────────────────────────────────────
cmd_unpause_all_groups() {
  : "${CONTRACT_ID:?CONTRACT_ID required}"
  : "${ADMIN_SECRET:?ADMIN_SECRET required}"

  log "Fetching group IDs..."
  GROUP_COUNT=$(stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$STELLAR_NETWORK" \
    --rpc-url "$STELLAR_RPC_URL" \
    --source-account "$ADMIN_SECRET" \
    -- get_group_count 2>/dev/null || echo "0")

  if [ "$GROUP_COUNT" -eq 0 ]; then
    ok "No groups found"
    return 0
  fi

  ADMIN_ADDRESS=$(stellar keys address "$(basename "$ADMIN_SECRET")" 2>/dev/null || echo "$ADMIN_SECRET")

  for i in $(seq 0 $(( GROUP_COUNT - 1 ))); do
    log "Unpausing group ${i}..."
    stellar contract invoke \
      --id "$CONTRACT_ID" \
      --network "$STELLAR_NETWORK" \
      --rpc-url "$STELLAR_RPC_URL" \
      --source-account "$ADMIN_SECRET" \
      -- unpause_group --group_id "$i" --caller "$ADMIN_ADDRESS" 2>/dev/null \
      && ok "Group ${i} unpaused" \
      || echo -e "${ERR} Failed to unpause group ${i}" >&2
  done
}

# ── contract-rollback ─────────────────────────────────────────────────────────
cmd_contract_rollback() {
  local run_id=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --run-id) run_id="$2"; shift 2 ;;
      *) fail "Unknown option: $1" ;;
    esac
  done
  : "${run_id:?--run-id <github-run-id> required}"
  : "${GH_TOKEN:?GH_TOKEN required}"

  log "Starting contract rollback from run ${run_id}..."
  ROLLBACK_ARTIFACT_RUN_ID="$run_id" \
  STELLAR_NETWORK="$STELLAR_NETWORK" \
  STELLAR_RPC_URL="$STELLAR_RPC_URL" \
  DEPLOYER_SECRET="${DEPLOYER_SECRET:-$ADMIN_SECRET}" \
  GH_TOKEN="$GH_TOKEN" \
  REPO="$REPO" \
  bash "$(dirname "$0")/rollback.sh"

  ok "Contract rollback complete"
}

# ── data-restore ──────────────────────────────────────────────────────────────
cmd_data_restore() {
  local job_id="" latest=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --job-id) job_id="$2"; shift 2 ;;
      --latest) latest=true; shift ;;
      *) fail "Unknown option: $1" ;;
    esac
  done

  if $latest; then
    log "Restoring latest completed backup..."
    RESULT=$(curl -sf -X POST "${BACKEND_URL}/api/v1/recovery/restore-latest" \
      -H 'Content-Type: application/json' \
      -d '{"type":"full"}')
  elif [ -n "$job_id" ]; then
    log "Restoring backup job ${job_id}..."
    RESULT=$(curl -sf -X POST "${BACKEND_URL}/api/v1/recovery/restore" \
      -H 'Content-Type: application/json' \
      -d "{\"jobId\":\"${job_id}\"}")
  else
    fail "Provide --job-id <id> or --latest"
  fi

  RESTORED_AT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('restoredAt','?'))" 2>/dev/null || echo "?")
  RECORD_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('recordCount','?'))" 2>/dev/null || echo "?")
  ok "Restore complete — ${RECORD_COUNT} records restored at ${RESTORED_AT}"
}

# ── dispatch ──────────────────────────────────────────────────────────────────
case "$COMMAND" in
  health-check)       cmd_health_check "$@" ;;
  pause-all-groups)   cmd_pause_all_groups "$@" ;;
  unpause-all-groups) cmd_unpause_all_groups "$@" ;;
  contract-rollback)  cmd_contract_rollback "$@" ;;
  data-restore)       cmd_data_restore "$@" ;;
  ""|help|--help)
    echo "Usage: dr_recover.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  health-check                              Verify all systems operational"
    echo "  pause-all-groups                          Pause every active group"
    echo "  unpause-all-groups                        Unpause every active group"
    echo "  contract-rollback  --run-id <run-id>      Roll back to a previous WASM"
    echo "  data-restore       --job-id <id>          Restore a specific backup"
    echo "  data-restore       --latest               Restore the latest backup"
    ;;
  *) fail "Unknown command: ${COMMAND}. Run 'dr_recover.sh help' for usage." ;;
esac
