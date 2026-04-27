#!/usr/bin/env bash
# scripts/migrate.sh
# CLI wrapper for on-chain schema migrations.
#
# Usage:
#   migrate.sh apply   --network testnet --contract C... --admin S... --xlm-token C...
#   migrate.sh rollback --network testnet --contract C... --admin S...
#   migrate.sh status  --network testnet --contract C...
#
# Required env vars (or pass as flags):
#   STELLAR_NETWORK      testnet | mainnet
#   STELLAR_RPC_URL      RPC endpoint
#   CONTRACT_ID          deployed contract address
#   ADMIN_SECRET         Stellar secret key of the contract admin
#   XLM_TOKEN_ADDRESS    SEP-41 XLM SAC address (required for apply)
set -euo pipefail

COMMAND="${1:-}"
shift || true

# ─── Defaults ────────────────────────────────────────────────────────────────
NETWORK="${STELLAR_NETWORK:-testnet}"
RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}"
CONTRACT_ID="${CONTRACT_ID:-}"
ADMIN_SECRET="${ADMIN_SECRET:-}"
XLM_TOKEN="${XLM_TOKEN_ADDRESS:-}"

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --network)       NETWORK="$2";       shift 2 ;;
    --rpc-url)       RPC_URL="$2";       shift 2 ;;
    --contract)      CONTRACT_ID="$2";   shift 2 ;;
    --admin)         ADMIN_SECRET="$2";  shift 2 ;;
    --xlm-token)     XLM_TOKEN="$2";     shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ─── Validation ───────────────────────────────────────────────────────────────
: "${CONTRACT_ID:?--contract / CONTRACT_ID is required}"
: "${ADMIN_SECRET:?--admin / ADMIN_SECRET is required}"

# ─── Stellar CLI identity setup ───────────────────────────────────────────────
IDENTITY="migrate-admin-$$"
cleanup() { stellar keys rm "$IDENTITY" 2>/dev/null || true; }
trap cleanup EXIT

echo "$ADMIN_SECRET" | stellar keys add "$IDENTITY" --secret-key --stdin

invoke() {
  stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$NETWORK" \
    --rpc-url "$RPC_URL" \
    --source-account "$IDENTITY" \
    -- "$@"
}

# ─── Commands ─────────────────────────────────────────────────────────────────
case "$COMMAND" in

  apply)
    : "${XLM_TOKEN:?--xlm-token / XLM_TOKEN_ADDRESS is required for apply}"
    echo "Applying migration on ${NETWORK}…"
    echo "  Contract : ${CONTRACT_ID}"
    echo "  XLM SAC  : ${XLM_TOKEN}"
    invoke migrate_apply --xlm_token_address "$XLM_TOKEN"
    echo "✅ Migration applied."
    ;;

  rollback)
    echo "Rolling back migration on ${NETWORK}…"
    echo "  Contract : ${CONTRACT_ID}"
    invoke migrate_rollback
    echo "✅ Migration rolled back."
    ;;

  status)
    echo "Schema version on ${NETWORK}:"
    invoke get_schema_version
    echo
    echo "Last migration record:"
    invoke get_migration_record || echo "  (none)"
    ;;

  *)
    cat <<'EOF'
Usage:
  migrate.sh <command> [options]

Commands:
  apply     Apply the next pending migration (v1 → v2)
  rollback  Reverse the last applied migration
  status    Show current schema version and last migration record

Options:
  --network      testnet | mainnet  (default: testnet)
  --rpc-url      RPC endpoint
  --contract     Contract ID (C...)
  --admin        Admin secret key (S...) — use a secrets manager in production
  --xlm-token    XLM SAC address (required for apply)

Environment variables (alternative to flags):
  STELLAR_NETWORK, STELLAR_RPC_URL, CONTRACT_ID, ADMIN_SECRET, XLM_TOKEN_ADDRESS
EOF
    exit 1
    ;;
esac
