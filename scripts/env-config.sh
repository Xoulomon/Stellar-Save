#!/usr/bin/env bash
# Environment Configuration Manager
# Manages environment-specific settings for Stellar-Save deployments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Environment definitions
declare -A ENV_CONFIG=(
  ["dev.network"]="testnet"
  ["dev.rpc_url"]="https://soroban-testnet.stellar.org"
  ["dev.frontend_url"]="https://dev.stellar-save.app"
  ["dev.api_base"]="https://api-dev.stellar-save.app"
  ["dev.auto_deploy"]="true"
  
  ["staging.network"]="testnet"
  ["staging.rpc_url"]="https://soroban-testnet.stellar.org"
  ["staging.frontend_url"]="https://staging.stellar-save.app"
  ["staging.api_base"]="https://api-staging.stellar-save.app"
  ["staging.auto_deploy"]="true"
  
  ["production.network"]="mainnet"
  ["production.rpc_url"]="https://soroban-rpc.mainnet.stellar.gateway.fm"
  ["production.frontend_url"]="https://stellar-save.app"
  ["production.api_base"]="https://api.stellar-save.app"
  ["production.auto_deploy"]="false"
)

# Get environment variable
get_env_var() {
  local env=$1
  local var=$2
  echo "${ENV_CONFIG[${env}.${var}]}"
}

# Set environment variables for deployment
set_deployment_env() {
  local env=$1
  
  export STELLAR_ENV="${env}"
  export STELLAR_NETWORK=$(get_env_var "${env}" "network")
  export STELLAR_RPC_URL=$(get_env_var "${env}" "rpc_url")
  export FRONTEND_URL=$(get_env_var "${env}" "frontend_url")
  export API_BASE=$(get_env_var "${env}" "api_base")
  export AUTO_DEPLOY=$(get_env_var "${env}" "auto_deploy")
  
  echo "Environment variables set for: ${env}"
  echo "  Network: ${STELLAR_NETWORK}"
  echo "  RPC URL: ${STELLAR_RPC_URL}"
  echo "  Frontend URL: ${FRONTEND_URL}"
}

# Print environment configuration
print_env_config() {
  local env=$1
  
  echo "Environment: ${env}"
  echo "  Network: $(get_env_var "${env}" "network")"
  echo "  RPC URL: $(get_env_var "${env}" "rpc_url")"
  echo "  Frontend URL: $(get_env_var "${env}" "frontend_url")"
  echo "  API Base: $(get_env_var "${env}" "api_base")"
  echo "  Auto Deploy: $(get_env_var "${env}" "auto_deploy")"
}

# List all environments
list_environments() {
  echo "Available environments:"
  echo "  - dev"
  echo "  - staging"
  echo "  - production"
}

# Main CLI
case "${1:-help}" in
  set)
    set_deployment_env "${2:-dev}"
    ;;
  config)
    print_env_config "${2:-dev}"
    ;;
  list)
    list_environments
    ;;
  help|--help|-h)
    cat <<'EOF'
Environment Configuration Manager

Usage:
  env-config.sh [command] [environment]

Commands:
  set <env>      Set environment variables for deployment
  config <env>   Print configuration for environment
  list           List all available environments
  help           Show this help message

Environments:
  dev            Development (Testnet)
  staging        Staging (Testnet)
  production     Production (Mainnet)

Examples:
  ./scripts/env-config.sh set dev
  ./scripts/env-config.sh config staging
  ./scripts/env-config.sh list
EOF
    ;;
  *)
    echo "Unknown command: $1"
    echo "Run with --help for usage information"
    exit 1
    ;;
esac
