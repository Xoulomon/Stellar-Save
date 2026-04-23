# Stellar-Save Deployment Guide

Complete guide for deploying the Stellar-Save smart contract to Stellar testnet and mainnet.

**Version**: 1.0.0  
**Last Updated**: 2026-02-24

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Building the Contract](#building-the-contract)
4. [Testnet Deployment](#testnet-deployment)
5. [Mainnet Deployment](#mainnet-deployment)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Deployment Checklist](#deployment-checklist)

---

## Prerequisites

### Required Tools

1. **Rust Toolchain** (1.70+)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   ```

2. **Stellar CLI** (Latest)
   ```bash
   cargo install --locked stellar-cli
   ```

3. **Git**
   ```bash
   git --version  # Verify installation
   ```

### System Requirements

- **OS**: Linux, macOS, or Windows (WSL2)
- **RAM**: 4GB minimum
- **Disk**: 2GB free space
- **Network**: Stable internet connection

### Knowledge Requirements

- Basic understanding of Stellar blockchain
- Familiarity with command-line tools
- Understanding of smart contract deployment

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Network Configuration
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Contract IDs (will be filled after deployment)
CONTRACT_STELLAR_SAVE=

# Frontend Configuration
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

### 3. Create Deployment Identity

**For Testnet:**
```bash
stellar keys generate deployer --network testnet
```

**For Mainnet:**
```bash
stellar keys generate deployer --network mainnet
```

**View your address:**
```bash
stellar keys address deployer
```

### 4. Fund Your Account

**Testnet (Free):**
```bash
stellar keys fund deployer --network testnet
```

Or use the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

**Mainnet:**
- Purchase XLM from an exchange
- Send to your deployer address
- Minimum: ~10 XLM for deployment fees

---

## Building the Contract

### 1. Run Tests

Ensure all tests pass before deployment:

```bash
cargo test --workspace
```

Expected output:
```
running 50 tests
test result: ok. 50 passed; 0 failed; 0 ignored
```

### 2. Build Optimized WASM

```bash
./scripts/build.sh
```

Or manually:
```bash
cargo build --target wasm32-unknown-unknown --release --package stellar-save
```

### 3. Verify Build Output

```bash
ls -lh target/wasm32-unknown-unknown/release/stellar_save.wasm
```

Expected size: ~100-200 KB

### 4. Optimize WASM (Optional)

For production, optimize the WASM file:

```bash
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm
```

---

## Testnet Deployment

### Quick Deployment

Use the automated script:

```bash
./scripts/deploy_testnet.sh
```

### Manual Deployment

#### Step 1: Set Network

```bash
export STELLAR_NETWORK=testnet
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

#### Step 2: Deploy Contract

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network testnet
```

**Output:**
```
Contract deployed successfully!
Contract ID: CBQHNAXSI55GX2GN6D67GK7BHKQKJNYBNZW7M5QWSXMEEJ6RVAHTYU7
```

#### Step 3: Save Contract ID

```bash
export CONTRACT_ID=CBQHNAXSI55GX2GN6D67GK7BHKQKJNYBNZW7M5QWSXMEEJ6RVAHTYU7
echo "CONTRACT_STELLAR_SAVE=$CONTRACT_ID" >> .env
```

#### Step 4: Initialize Contract (Optional)

If your contract requires initialization:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- update_config \
  --new_config '{"admin":"'$(stellar keys address deployer)'","min_contribution":"10000000","max_contribution":"1000000000","min_members":"2","max_members":"50","min_cycle_duration":"86400","max_cycle_duration":"2592000"}'
```

---

## Mainnet Deployment

### Pre-Deployment Checklist

- [ ] All tests passing on testnet
- [ ] Contract audited (recommended)
- [ ] Sufficient XLM in deployer account (~10 XLM)
- [ ] Backup of deployer keys
- [ ] Deployment plan documented
- [ ] Rollback strategy prepared

### Deployment Steps

#### Step 1: Switch to Mainnet

```bash
export STELLAR_NETWORK=mainnet
export STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
```

Update `.env`:
```bash
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
```

#### Step 2: Verify Account Balance

```bash
stellar account balance deployer --network mainnet
```

Ensure you have at least 10 XLM.

#### Step 3: Deploy to Mainnet

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network mainnet
```

**⚠️ Warning**: This will consume XLM. Double-check everything before proceeding.

#### Step 4: Record Mainnet Contract ID

```bash
export MAINNET_CONTRACT_ID=<your_mainnet_contract_id>
echo "CONTRACT_STELLAR_SAVE_MAINNET=$MAINNET_CONTRACT_ID" >> .env
```

#### Step 5: Initialize Mainnet Contract

```bash
stellar contract invoke \
  --id $MAINNET_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- update_config \
  --new_config '{"admin":"'$(stellar keys address deployer)'","min_contribution":"10000000","max_contribution":"1000000000","min_members":"2","max_members":"50","min_cycle_duration":"86400","max_cycle_duration":"2592000"}'
```

---

## Post-Deployment Configuration

### 1. Update Frontend Configuration

Edit `frontend/.env`:

```bash
VITE_CONTRACT_ID=<your_contract_id>
VITE_STELLAR_NETWORK=testnet  # or mainnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

### 2. Configure Contract Parameters

Set global configuration:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- update_config \
  --new_config '{
    "admin": "'$(stellar keys address deployer)'",
    "min_contribution": "10000000",
    "max_contribution": "1000000000",
    "min_members": "2",
    "max_members": "50",
    "min_cycle_duration": "86400",
    "max_cycle_duration": "2592000"
  }'
```

### 3. Document Deployment

Create a deployment record:

```bash
cat > DEPLOYMENT_RECORD.md << EOF
# Deployment Record

**Date**: $(date)
**Network**: $STELLAR_NETWORK
**Contract ID**: $CONTRACT_ID
**Deployer**: $(stellar keys address deployer)
**WASM Hash**: $(sha256sum target/wasm32-unknown-unknown/release/stellar_save.wasm | cut -d' ' -f1)

## Configuration
- Min Contribution: 1 XLM
- Max Contribution: 100 XLM
- Min Members: 2
- Max Members: 50
- Min Cycle: 1 day
- Max Cycle: 30 days
EOF
```

---

## Verification

### 1. Verify Contract Deployment

```bash
stellar contract info \
  --id $CONTRACT_ID \
  --network testnet
```

### 2. Test Contract Functions

**Create a test group:**
```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- create_group \
  --creator $(stellar keys address deployer) \
  --contribution_amount 100000000 \
  --cycle_duration 604800 \
  --max_members 5
```

**Get group details:**
```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --network testnet \
  -- get_group \
  --group_id 1
```

### 3. Verify on Stellar Expert

**Testnet:**
```
https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID
```

**Mainnet:**
```
https://stellar.expert/explorer/public/contract/$CONTRACT_ID
```

---

## Troubleshooting

### Common Issues

#### 1. "Insufficient Balance" Error

**Problem**: Not enough XLM for deployment fees.

**Solution**:
```bash
# Testnet
stellar keys fund deployer --network testnet

# Mainnet
# Send more XLM to your deployer address
```

#### 2. "WASM File Not Found"

**Problem**: Contract not built.

**Solution**:
```bash
./scripts/build.sh
```

#### 3. "Network Connection Failed"

**Problem**: RPC URL incorrect or network down.

**Solution**:
```bash
# Check RPC status
curl https://soroban-testnet.stellar.org/health

# Try alternative RPC
export STELLAR_RPC_URL=https://horizon-testnet.stellar.org
```

#### 4. "Contract Already Exists"

**Problem**: Trying to deploy same contract twice.

**Solution**: Use the existing contract ID or deploy with different parameters.

#### 5. "Authorization Failed"

**Problem**: Wrong identity or insufficient permissions.

**Solution**:
```bash
# Verify identity
stellar keys show deployer

# Ensure identity is funded
stellar account balance deployer --network testnet
```

### Debug Mode

Enable verbose logging:

```bash
export RUST_LOG=debug
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network testnet \
  --verbose
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`cargo test --workspace`)
- [ ] Contract built successfully (`./scripts/build.sh`)
- [ ] Deployer identity created and funded
- [ ] Environment variables configured
- [ ] Network RPC URL verified
- [ ] Deployment script reviewed

### During Deployment

- [ ] Network set correctly (testnet/mainnet)
- [ ] Contract deployed successfully
- [ ] Contract ID recorded
- [ ] Transaction hash saved
- [ ] Deployment costs documented

### Post-Deployment

- [ ] Contract verified on explorer
- [ ] Test functions executed successfully
- [ ] Configuration initialized
- [ ] Frontend updated with contract ID
- [ ] Deployment documented
- [ ] Team notified
- [ ] Monitoring setup (if applicable)

---

## Deployment Scripts Reference

### build.sh

Builds the contract for deployment:

```bash
#!/bin/bash
cargo build --target wasm32-unknown-unknown --release --package stellar-save
```

### deploy_testnet.sh

Automated testnet deployment:

```bash
#!/bin/bash
set -e

echo "Building contract..."
./scripts/build.sh

echo "Deploying to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network testnet)

echo "Contract deployed: $CONTRACT_ID"
echo "CONTRACT_STELLAR_SAVE=$CONTRACT_ID" >> .env
```

### deploy_mainnet.sh

Automated mainnet deployment with safety checks:

```bash
#!/bin/bash
set -e

echo "⚠️  MAINNET DEPLOYMENT - This will cost real XLM"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Deployment cancelled"
  exit 1
fi

echo "Building contract..."
./scripts/build.sh

echo "Deploying to mainnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network mainnet)

echo "Contract deployed: $CONTRACT_ID"
echo "CONTRACT_STELLAR_SAVE_MAINNET=$CONTRACT_ID" >> .env
```

---

## Network Endpoints

### Testnet

- **RPC**: `https://soroban-testnet.stellar.org`
- **Horizon**: `https://horizon-testnet.stellar.org`
- **Explorer**: `https://stellar.expert/explorer/testnet`
- **Friendbot**: `https://friendbot.stellar.org`

### Mainnet

- **RPC**: `https://soroban-mainnet.stellar.org`
- **Horizon**: `https://horizon.stellar.org`
- **Explorer**: `https://stellar.expert/explorer/public`

---

## Cost Estimates

### Testnet

- **Deployment**: Free (funded by Friendbot)
- **Transactions**: Free

### Mainnet

- **Contract Deployment**: ~5-10 XLM
- **Contract Initialization**: ~0.1 XLM
- **Transaction Fees**: ~0.00001 XLM per operation

**Note**: Costs vary based on network congestion and contract size.

---

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use hardware wallets** for mainnet deployments
3. **Test thoroughly** on testnet before mainnet
4. **Audit contracts** before mainnet deployment
5. **Keep backups** of deployer keys
6. **Monitor contract** activity post-deployment
7. **Have a rollback plan** ready
8. **Use multi-sig** for admin operations (recommended)

---

## Support

- **Documentation**: [GitHub Docs](https://github.com/Xoulomon/Stellar-Save/tree/main/docs)
- **Issues**: [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues)
- **Stellar Discord**: [discord.gg/stellar](https://discord.gg/stellar)
- **Stellar Developers**: [developers.stellar.org](https://developers.stellar.org)

---

## Next Steps

After successful deployment:

1. ✅ Update frontend with contract ID
2. ✅ Configure contract parameters
3. ✅ Test all contract functions
4. ✅ Set up monitoring and alerts
5. ✅ Document deployment for team
6. ✅ Announce to community

---

**Deployment Guide Version**: 1.0.0  
**Contract Version**: 1.0.0  
**Last Updated**: 2026-02-24

5. **Verify Deployment**
   Check contract is deployed:
   ```bash
   stellar contract info --id <contract_id> --network testnet
   ```

## Mainnet Deployment

Mainnet deployment requires careful verification and should only be done after thorough testing.

### Pre-Deployment Checklist

- [ ] All tests pass on testnet
- [ ] Contract code audited
- [ ] Environment variables set for mainnet
- [ ] Backup of current state
- [ ] Team approval obtained

### Step-by-Step Process

1. **Configure Environment**
   ```bash
   export STELLAR_NETWORK="mainnet"
   export STELLAR_RPC_URL="https://soroban-rpc.mainnet.stellar.gateway.fm"
   ```

2. **Build Contracts**
   ```bash
   ./scripts/build.sh
   ```

3. **Deploy Contracts**
   ```bash
   ./scripts/deploy_mainnet.sh
   ```
   The script will prompt for confirmation before proceeding.

4. **Record Contract IDs**
   Update production `.env` file with deployed contract IDs.

5. **Update Frontend Configuration**
   Ensure frontend environment variables are updated with mainnet contract IDs.

## Contract Verification

After deployment, verify your contracts on the network:

1. **Verify Contract Code**
   ```bash
   stellar contract verify \
     --id <contract_id> \
     --network <testnet|mainnet> \
     --source <path_to_source>
   ```

2. **Check Contract Info**
   ```bash
   stellar contract info --id <contract_id> --network <network>
   ```

3. **Test Basic Functionality**
   Use Stellar Lab or CLI to invoke contract functions.

## Post-Deployment Testing

### Automated Testing

1. **Run Integration Tests**
   ```bash
   # Update test environment to point to deployed contracts
   export CONTRACT_STELLAR_SAVE=<deployed_id>
   cargo test --workspace -- --nocapture
   ```

### Manual Testing

1. **Frontend Integration**
   - Deploy frontend to staging environment
   - Test all user flows with deployed contracts
   - Verify transaction signing and submission

2. **Cross-Contract Interactions**
   - Test any contract-to-contract calls
   - Verify token transfers and allowances

3. **Load Testing**
   - Simulate expected user load
   - Monitor RPC rate limits and performance

## Troubleshooting

### Common Issues

**Build Failures**
- Ensure Rust toolchain is properly installed
- Check `rust-toolchain.toml` for correct version
- Run `cargo clean` and rebuild

**Deployment Failures**
- Verify network connectivity to RPC endpoint
- Check account has sufficient XLM for fees
- Ensure source account is properly funded

**Contract Verification Issues**
- Confirm source code matches deployed WASM
- Check compiler versions match
- Verify optimization settings

**Network-Specific Issues**
- Testnet: Check faucet for account funding
- Mainnet: Verify RPC endpoint and network passphrase

### Getting Help

- Check existing issues in the repository
- Review Stellar documentation: https://developers.stellar.org/
- Join Stellar Discord for community support

### Rollback Procedures

If issues are discovered post-deployment:

1. **Pause Frontend**: Disable user interactions
2. **Assess Impact**: Determine scope of issues
3. **Deploy Fix**: If needed, deploy updated contract
4. **Migrate State**: If required, implement state migration
5. **Resume Operations**: Re-enable frontend after verification</content>
<parameter name="filePath">c:\Users\USER\Desktop\solo\Stellar-Save\docs\deployment.md