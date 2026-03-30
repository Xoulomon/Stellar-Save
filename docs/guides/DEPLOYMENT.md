# Stellar-Save Deployment Guide

Complete step-by-step guide for deploying Stellar-Save to Stellar testnet and mainnet.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Contract Deployment](#contract-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Rust 1.70+ with `wasm32-unknown-unknown` target
- Stellar CLI (`stellar-cli` or `soroban-cli`)
- Node.js 18+ and npm/yarn
- Git

### Install Stellar CLI
```bash
cargo install --locked stellar-cli --features opt
```

### Configure Network
```bash
# Add Testnet
stellar network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Add Mainnet (Pubnet)
stellar network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### Create Identity
```bash
# Generate new identity for deployment
stellar keys generate deployer --network testnet

# Fund testnet account
stellar keys fund deployer --network testnet

# For mainnet, fund via exchange or Stellar account
```

## Contract Deployment

### Step 1: Build Contract

Navigate to contract directory and build:

```bash
cd contracts/stellar-save

# Build optimized WASM
stellar contract build

# Output: target/wasm32-unknown-unknown/release/stellar_save.wasm
```

### Step 2: Optimize WASM (Optional but Recommended)

```bash
# Install wasm-opt if not already installed
# On macOS: brew install binaryen
# On Linux: apt-get install binaryen

wasm-opt -Oz \
  target/wasm32-unknown-unknown/release/stellar_save.wasm \
  -o target/wasm32-unknown-unknown/release/stellar_save_optimized.wasm
```

### Step 3: Deploy to Testnet

```bash
# Deploy contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network testnet

# Save the contract ID output (e.g., CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
```

### Step 4: Initialize Contract

```bash
# Set contract ID as environment variable
export CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Initialize contract (if your contract has an initialize function)
stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin deployer
```

### Step 5: Deploy to Mainnet

After thorough testing on testnet:

```bash
# Ensure mainnet identity is funded
stellar keys address deployer

# Deploy to mainnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --source deployer \
  --network mainnet

# Initialize mainnet contract
stellar contract invoke \
  --id $MAINNET_CONTRACT_ID \
  --source deployer \
  --network mainnet \
  -- \
  initialize \
  --admin deployer
```

### Step 6: Verify Deployment

```bash
# Test contract is accessible
stellar contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- \
  get_total_groups_created

# Should return 0 for new deployment
```

## Frontend Deployment

### Step 1: Configure Environment

Create `.env.production` in `frontend/` directory:

```env
# For Testnet
VITE_STELLAR_NETWORK=testnet
VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
VITE_STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_HORIZON_URL=https://horizon-testnet.stellar.org

# For Mainnet
# VITE_STELLAR_NETWORK=mainnet
# VITE_STELLAR_RPC_URL=https://soroban-mainnet.stellar.org:443
# VITE_STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
# VITE_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# VITE_HORIZON_URL=https://horizon.stellar.org
```

### Step 2: Build Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Output: dist/ directory
```

### Step 3: Deploy to Hosting Platform

#### Option A: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Follow prompts to configure project
```

#### Option B: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Or connect GitHub repo via Netlify dashboard
```

#### Option C: Static Hosting (AWS S3, Cloudflare Pages, etc.)

```bash
# Upload dist/ contents to your hosting provider
# Example for AWS S3:
aws s3 sync dist/ s3://your-bucket-name --delete

# Configure CloudFront or CDN as needed
```

### Step 4: Configure Domain (Optional)

- Point your domain DNS to hosting provider
- Configure SSL/TLS certificate
- Update CORS settings if needed

## Environment Variables

### Contract Environment Variables

No environment variables needed for deployed contract. Configuration is done via contract initialization.

### Frontend Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_STELLAR_NETWORK` | Network identifier | `testnet` or `mainnet` |
| `VITE_STELLAR_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org:443` |
| `VITE_STELLAR_NETWORK_PASSPHRASE` | Network passphrase | `Test SDF Network ; September 2015` |
| `VITE_CONTRACT_ID` | Deployed contract ID | `CXXXXX...` |
| `VITE_HORIZON_URL` | Horizon API endpoint | `https://horizon-testnet.stellar.org` |

### Optional Analytics Variables (if implementing #384)

| Variable | Description |
|----------|-------------|
| `VITE_ANALYTICS_ID` | Analytics tracking ID |
| `VITE_ANALYTICS_ENABLED` | Enable/disable analytics |

## Troubleshooting

### Contract Deployment Issues

#### Error: "insufficient balance"
**Solution:** Fund your deployer account
```bash
# Testnet
stellar keys fund deployer --network testnet

# Mainnet - transfer XLM from exchange or another account
```

#### Error: "transaction failed"
**Solution:** Check contract build and WASM validity
```bash
# Rebuild contract
stellar contract build

# Check WASM file exists
ls -lh target/wasm32-unknown-unknown/release/stellar_save.wasm
```

#### Error: "resource limits exceeded"
**Solution:** Optimize contract or increase resource limits
```bash
# Use optimized WASM
wasm-opt -Oz input.wasm -o output.wasm

# Or adjust fee bump in deployment
stellar contract deploy --wasm contract.wasm --source deployer --network testnet --fee 10000000
```

### Frontend Build Issues

#### Error: "Module not found"
**Solution:** Clean install dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Environment variable not defined"
**Solution:** Ensure `.env.production` exists and variables are prefixed with `VITE_`
```bash
# Check environment file
cat .env.production

# Verify variables are loaded
npm run build -- --debug
```

#### Error: "Contract invocation failed"
**Solution:** Verify contract ID and network configuration
```bash
# Test contract directly
stellar contract invoke --id $CONTRACT_ID --network testnet -- get_total_groups_created

# Check network passphrase matches
```

### Network Issues

#### Error: "RPC endpoint unreachable"
**Solution:** Check network status and try alternative RPC
```bash
# Test RPC endpoint
curl https://soroban-testnet.stellar.org:443

# Use alternative RPC if available
# Update VITE_STELLAR_RPC_URL in .env
```

#### Error: "Transaction timeout"
**Solution:** Increase timeout or retry
```bash
# Retry deployment with higher timeout
stellar contract deploy --wasm contract.wasm --source deployer --network testnet --timeout 120
```

### Post-Deployment Verification

#### Verify Contract Functions
```bash
# Test read functions
stellar contract invoke --id $CONTRACT_ID --network testnet -- get_total_groups_created

# Test with actual parameters
stellar contract invoke --id $CONTRACT_ID --network testnet -- get_group --group_id 1
```

#### Verify Frontend Connection
1. Open browser developer console
2. Navigate to deployed frontend URL
3. Check for connection errors
4. Test wallet connection (Freighter, Albedo, etc.)
5. Attempt a test transaction

## Security Checklist

Before mainnet deployment:

- [ ] Contract audited by security professionals
- [ ] All tests passing (unit, integration, e2e)
- [ ] Testnet deployment tested thoroughly
- [ ] Admin keys secured (hardware wallet recommended)
- [ ] Emergency pause mechanism tested
- [ ] Rate limiting and access controls verified
- [ ] Frontend security headers configured
- [ ] HTTPS enabled with valid certificate
- [ ] Environment variables secured (not in source control)
- [ ] Monitoring and alerting configured

## Monitoring

### Contract Monitoring
- Monitor contract balance and activity via Stellar Expert
- Set up alerts for unusual transaction patterns
- Track contract invocations and errors

### Frontend Monitoring
- Configure uptime monitoring (UptimeRobot, Pingdom)
- Set up error tracking (Sentry, LogRocket)
- Monitor performance metrics (Lighthouse CI)

## Rollback Procedure

If issues are discovered post-deployment:

1. **Frontend:** Revert to previous deployment via hosting platform
2. **Contract:** Deploy new version with fixes (contracts are immutable, so deploy new instance)
3. **Migration:** If needed, migrate state to new contract version
4. **Communication:** Notify users of maintenance and updates

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar CLI Reference](https://developers.stellar.org/docs/tools/developer-tools)
- [Freighter Wallet](https://www.freighter.app/)

## Support

For deployment issues:
- Check [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)
- Open issue on GitHub
- Join Stellar Discord community
