# Local Development Setup for Stellar-Save

## One-Command Setup (Docker — recommended)

The fastest way to get a fully working local stack (Postgres, Redis, backend, frontend, and a local Soroban node) is with Docker Compose:

```bash
# 1. Clone
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# 2. Start everything (first run builds images and seeds test data)
docker compose up --build
```

| Service   | URL                          | Notes                        |
|-----------|------------------------------|------------------------------|
| Frontend  | http://localhost:5173        | Vite dev server (hot reload) |
| Backend   | http://localhost:3001        | Express API                  |
| Horizon   | http://localhost:8000        | Local Stellar/Soroban node   |
| Postgres  | localhost:5432               | user: stellar / stellar_dev  |
| Redis     | localhost:6379               | No password in dev           |

The `seed` container runs automatically on first startup and inserts test data so you can exercise core flows immediately.

**Teardown (clean):**

```bash
docker compose down -v   # removes containers and named volumes
```

The compose setup is idempotent — `docker compose up` after `down` produces the same state.

---

## Manual Setup (without Docker)

## Prerequisites

- Git >= 2.40: https://git-scm.com/downloads
- Node.js 20.x and npm 10.x: https://nodejs.org/
- Rust 1.81.0 and Cargo: https://www.rust-lang.org/tools/install
- Docker 24.x: https://docs.docker.com/get-docker/
- Stellar CLI 22.7.1: https://github.com/stellar/stellar-cli/releases
- `cargo-audit` for dependency security checks: https://github.com/RustSec/cargo-audit

## Install Commands

```bash
# Clone the repository
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Install Rust toolchain
rustup toolchain install 1.81.0
rustup default 1.81.0

# Install cargo-audit
cargo install cargo-audit

# Ensure Node.js 20.x and npm 10.x are installed
node --version
npm --version

# Install Docker and verify
docker --version
```

## Build the Project

```bash
# Install backend dependencies
cd backend
npm ci

# Install frontend dependencies
cd ../frontend
npm ci

# Build the smart contract
cd ../contracts/stellar-save
cargo build --target wasm32-unknown-unknown --release
```

## Run Tests

```bash
# Backend tests
cd ../../backend
npm test

# Frontend tests
cd ../frontend
npm run test:coverage

# Contract tests
cd ../contracts/stellar-save
cargo test
```

## Deploy to Testnet

1. Generate or import a testnet keypair.

```bash
stellar keys generate --network testnet --no-fund --output-file testnet-deployer.json
```

2. Add the deployer key to Stellar CLI.

```bash
cat testnet-deployer.json | stellar keys add deployer --secret-key --stdin
```

3. Build the contract and deploy.

```bash
cd contracts/stellar-save
cargo build --target wasm32-unknown-unknown --release
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_save.wasm \
  --network testnet \
  --source-account deployer
```

4. Save the returned contract ID for subsequent invocations.

## Hello World Walkthrough

### 1. Create a group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- create_group \
  --creator "$CREATOR_ADDRESS" \
  --contribution_amount 100000000 \
  --cycle_duration 604800 \
  --max_members 3 \
  --token_address "$TOKEN_ADDRESS" \
  --grace_period_seconds 86400 \
  --payout_order Sequential
```

### 2. Join the group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member1 \
  -- join_group \
  --group_id 1 \
  --member "$MEMBER1_ADDRESS"

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member2 \
  -- join_group \
  --group_id 1 \
  --member "$MEMBER2_ADDRESS"
```

### 3. Activate the group

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- activate_group \
  --group_id 1 \
  --creator "$CREATOR_ADDRESS"
```

### 4. Contribute

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member1 \
  -- contribute \
  --group_id 1 \
  --member "$MEMBER1_ADDRESS" \
  --amount 100000000

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account member2 \
  -- contribute \
  --group_id 1 \
  --member "$MEMBER2_ADDRESS" \
  --amount 100000000
```

### 5. Trigger payout

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- execute_payout \
  --group_id 1
```

### 6. Confirm the next recipient

```bash
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network testnet \
  --source-account creator \
  -- get_next_recipient \
  --group_id 1
```
