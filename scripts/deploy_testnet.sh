<<<<<<< HEAD
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
=======
#!/usr/bin/env bash
set -euo pipefail

# Deploy stellar-save to Stellar testnet.
# Prerequisites:
#   stellar keys generate deployer --network testnet
#   stellar keys fund deployer --network testnet

NETWORK="testnet"
IDENTITY="${IDENTITY:-deployer}"
WASM="target/wasm32-unknown-unknown/release/stellar_save.wasm"

echo "==> Building contract..."
bash "$(dirname "$0")/build.sh"

echo "==> Uploading WASM to $NETWORK..."
WASM_HASH=$(stellar contract upload \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --wasm "$WASM")

echo "WASM hash: $WASM_HASH"

echo "==> Deploying contract..."
CONTRACT_ID=$(stellar contract deploy \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --wasm-hash "$WASM_HASH")

echo "✅ Contract deployed: $CONTRACT_ID"
echo "   Network: $NETWORK"
echo ""
echo "To create your first ROSCA group:"
echo "  stellar contract invoke \\"
echo "    --network $NETWORK --source $IDENTITY \\"
echo "    --id $CONTRACT_ID \\"
echo "    -- create_group \\"
echo "    --contribution_amount 100000000 \\"
echo "    --cycle_duration 100 \\"
echo "    --max_members 5"
>>>>>>> 46b7416 (feat: implement bug bounty program and vulnerability disclosure)
