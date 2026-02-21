#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if [ -z "$STELLAR_NETWORK" ]; then
  export STELLAR_NETWORK="mainnet"
fi

if [ -z "$STELLAR_RPC_URL" ]; then
  export STELLAR_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
fi

echo "⚠️  WARNING: Deploying to MAINNET"
echo "Network: $STELLAR_NETWORK"
echo "RPC URL: $STELLAR_RPC_URL"
echo ""
read -p "Are you sure you want to deploy to mainnet? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled"
  exit 1
fi

# Build contracts first
./scripts/build.sh

# Deploy each contract
for contract in contracts/*/; do
  contract_name=$(basename "$contract")
  wasm_file="target/wasm32-unknown-unknown/release/${contract_name//-/_}.wasm"
  
  if [ -f "$wasm_file" ]; then
    echo ""
    echo "Deploying $contract_name..."
    stellar contract deploy \
      --wasm "$wasm_file" \
      --network mainnet \
      --source-account default
  fi
done

echo ""
echo "✓ Mainnet deployment complete"
