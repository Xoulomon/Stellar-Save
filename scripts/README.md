# Development Scripts

Helper scripts for common development tasks.

## Available Scripts

### `build.sh`
Compiles all smart contracts for WASM target.

```bash
./scripts/build.sh
```

### `test.sh`
Runs all tests (contracts + frontend).

```bash
./scripts/test.sh
```

### `deploy_testnet.sh`
Deploys contracts to Stellar testnet.

```bash
./scripts/deploy_testnet.sh
```

**Environment Variables:**
- `STELLAR_NETWORK` - Network name (default: testnet)
- `STELLAR_RPC_URL` - RPC endpoint (default: https://soroban-testnet.stellar.org)

### `deploy_mainnet.sh`
Deploys contracts to Stellar mainnet with confirmation prompt.

```bash
./scripts/deploy_mainnet.sh
```

**Environment Variables:**
- `STELLAR_NETWORK` - Network name (default: mainnet)
- `STELLAR_RPC_URL` - RPC endpoint (default: https://soroban-rpc.mainnet.stellar.gateway.fm)

## Prerequisites

- Rust toolchain with `wasm32-unknown-unknown` target
- Stellar CLI (`stellar`)
- Node.js and npm (for frontend tests)
- Configured Stellar account (for deployments)

## Setup

Install Stellar CLI:
```bash
cargo install --locked stellar-cli
```

Add WASM target:
```bash
rustup target add wasm32-unknown-unknown
```

Configure network identity:
```bash
stellar keys generate default --network testnet
```
