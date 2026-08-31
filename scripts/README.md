# Development & Deployment Scripts

Helper scripts for building, testing, auditing, and deploying smart contracts across environments.

## Prerequisites

- **Rust Toolchain**: `1.81.0` (pinned via `rust-toolchain.toml`)
- **WASM Target**: `wasm32-unknown-unknown` (`rustup target add wasm32-unknown-unknown`)
- **Stellar CLI**: Installed and available in PATH (`cargo install --locked stellar-cli`)
- **Node.js & npm**: Node.js 18+ for test suite and root hooks

## Available Scripts

### `build.sh`
Compiles all Soroban smart contracts in the workspace for the `wasm32-unknown-unknown` target in release mode.

```bash
./scripts/build.sh
```

### `test.sh`
Executes the comprehensive repository test suite covering contract tests (`cargo test`) and frontend tests (`npm test`).

```bash
./scripts/test.sh
```

### `deploy_testnet.sh`
Deploys compiled WASM smart contract binaries to the Stellar Testnet.

```bash
# Configure testnet identity (one-time)
stellar keys generate deployer --network testnet

# Run deployment script
./scripts/deploy_testnet.sh
```

**Environment Overrides:**
- `STELLAR_NETWORK`: Network identifier (default: `testnet`).
- `STELLAR_RPC_URL`: Soroban RPC endpoint (default: `https://soroban-testnet.stellar.org`).

### `deploy_mainnet.sh`
Deploys compiled smart contracts to Stellar Mainnet with interactive safety confirmation prompts.

```bash
./scripts/deploy_mainnet.sh
```

**Environment Overrides:**
- `STELLAR_NETWORK`: Network identifier (default: `mainnet`).
- `STELLAR_RPC_URL`: Mainnet Soroban RPC endpoint.

### `pre-push-audit.sh`
Performs vulnerability audits on Rust (`cargo audit`) and Node (`npm audit`) dependencies prior to code pushes.

```bash
./scripts/pre-push-audit.sh
```
