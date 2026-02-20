# Environment Configuration

This document describes all environment variables and network configurations for the Stellar-Save project.

## Quick Setup

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration
3. Never commit `.env` to version control

## Environment Variables

### Stellar Network Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `STELLAR_NETWORK` | Network name | `testnet`, `mainnet`, `futurenet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `STELLAR_NETWORK_PASSPHRASE` | Network passphrase | `Test SDF Network ; September 2015` |

### Contract Addresses

Populated after deployment:

| Variable | Description |
|----------|-------------|
| `CONTRACT_GUESS_THE_NUMBER` | Guess the Number contract ID |
| `CONTRACT_FUNGIBLE_ALLOWLIST` | Fungible Token Allowlist contract ID |
| `CONTRACT_NFT_ENUMERABLE` | NFT Enumerable contract ID |

### Frontend Configuration

Frontend variables must be prefixed with `VITE_`:

| Variable | Description |
|----------|-------------|
| `VITE_STELLAR_NETWORK` | Network for frontend |
| `VITE_STELLAR_RPC_URL` | RPC URL for frontend |
| `VITE_CONTRACT_GUESS_THE_NUMBER` | Contract ID for frontend |
| `VITE_CONTRACT_FUNGIBLE_ALLOWLIST` | Contract ID for frontend |
| `VITE_CONTRACT_NFT_ENUMERABLE` | Contract ID for frontend |

### Development

| Variable | Description | Values |
|----------|-------------|--------|
| `NODE_ENV` | Node environment | `development`, `production` |

## Network Configurations

Network settings are defined in `environments.toml`:

### Testnet
```toml
[testnet]
rpc_url = "https://soroban-testnet.stellar.org"
network_passphrase = "Test SDF Network ; September 2015"
```

### Mainnet
```toml
[mainnet]
rpc_url = "https://soroban-rpc.mainnet.stellar.gateway.fm"
network_passphrase = "Public Global Stellar Network ; September 2015"
```

### Futurenet
```toml
[futurenet]
rpc_url = "https://rpc-futurenet.stellar.org"
network_passphrase = "Test SDF Future Network ; October 2022"
```

### Standalone (Local)
```toml
[standalone]
rpc_url = "http://localhost:8000/soroban/rpc"
network_passphrase = "Standalone Network ; February 2017"
```

## Usage in Scripts

Deployment scripts automatically use environment variables:

```bash
# Uses STELLAR_NETWORK and STELLAR_RPC_URL from .env
./scripts/deploy_testnet.sh

# Override with environment variables
STELLAR_NETWORK=mainnet ./scripts/deploy_mainnet.sh
```

## Security Notes

- ✅ `.env` is in `.gitignore` - never committed
- ✅ `.env.example` is committed - safe template
- ✅ Use different `.env` files for different environments
- ⚠️ Never expose private keys in environment variables
- ⚠️ Use Stellar CLI key management for secrets

## Example Configurations

### Development (Testnet)
```bash
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
VITE_STELLAR_NETWORK=testnet
NODE_ENV=development
```

### Production (Mainnet)
```bash
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
VITE_STELLAR_NETWORK=mainnet
NODE_ENV=production
```

### Local Development
```bash
STELLAR_NETWORK=standalone
STELLAR_RPC_URL=http://localhost:8000/soroban/rpc
VITE_STELLAR_NETWORK=standalone
NODE_ENV=development
```
