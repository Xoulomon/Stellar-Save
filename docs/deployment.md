# Deployment Guide

This guide provides step-by-step instructions for deploying Stellar-Save contracts to both testnet and mainnet environments.

## Prerequisites

Before deploying, ensure you have:

1. **Stellar CLI installed**: `cargo install stellar-cli`
2. **Rust toolchain**: Follow the setup in `ENVIRONMENT.md`
3. **Environment variables configured**: Copy `.env.example` to `.env` and set appropriate values
4. **Tested contracts**: Run `cargo test --workspace` to ensure all tests pass
5. **Sufficient XLM**: For deployment fees (testnet faucet available)

## Testnet Deployment

Testnet deployment is used for testing and validation before mainnet deployment.

### Step-by-Step Process

1. **Configure Environment**
   ```bash
   export STELLAR_NETWORK="testnet"
   export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
   ```

2. **Build Contracts**
   ```bash
   ./scripts/build.sh
   ```
   This compiles all contracts to WASM files in `target/wasm32-unknown-unknown/release/`.

3. **Deploy Contracts**
   ```bash
   ./scripts/deploy_testnet.sh
   ```
   Or manually:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
     --network testnet \
     --source-account default
   ```

4. **Record Contract IDs**
   After deployment, note the contract IDs returned by the CLI. Update your `.env` file:
   ```
   CONTRACT_STELLAR_SAVE=<deployed_contract_id>
   ```

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