#!/bin/bash
set -e

cd "$(dirname "$0")/.."

if [ -z "$STELLAR_NETWORK" ]; then
  export STELLAR_NETWORK="testnet"
fi

if [ -z "$STELLAR_RPC_URL" ]; then
  export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
fi

echo "Deploying to Testnet..."
echo "Network: $STELLAR_NETWORK"
echo "RPC URL: $STELLAR_RPC_URL"

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
      --network testnet \
      --source-account default
  fi
done

echo ""
echo "✓ Testnet deployment complete"
