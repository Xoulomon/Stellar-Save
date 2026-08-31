# Local Development Setup Guide

This guide walks you from a fresh clone to a fully running Stellar-Save stack — backend, frontend, Soroban smart contracts, and optional services — on your local machine.

> **Prerequisite checklist**  
> - Node.js 20+ and npm/pnpm  
> - Rust toolchain (see `rust-toolchain.toml` — currently `stable`)  
> - Docker and Docker Compose  
> - [Stellar CLI](https://developers.stellar.org/docs/tools/stellar-cli) (`stellar`)  
> - Git

---

## 1. Clone and install root dependencies

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save
npm install          # installs root deps and git hooks (Husky)
```

The root `package.json` uses **Turborepo** (`turbo.json`) to orchestrate builds across workspaces.

---

## 2. Start infrastructure services

The backend depends on **PostgreSQL** and **Redis**. The simplest way to run them locally is via Docker Compose:

```bash
docker compose up -d postgres redis
```

This starts:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

Optional services (Elasticsearch, monitoring stack) can be started with:

```bash
docker compose up -d elasticsearch
docker compose -f monitoring/docker-compose.yml up -d
```

---

## 3. Configure environment variables

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and fill in the required values:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for signing JWT access tokens (min 32 chars) | ✅ |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifetime (e.g. `15m`) | ✅ |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime in days | ✅ |
| `STELLAR_RPC_URL` | Soroban RPC endpoint (testnet: `https://soroban-testnet.stellar.org`) | ✅ |
| `STELLAR_NETWORK` | `testnet` or `mainnet` | ✅ |
| `STELLAR_NETWORK_PASSPHRASE` | Network passphrase | ✅ |
| `HORIZON_URL` | Horizon API (testnet: `https://horizon-testnet.stellar.org`) | ✅ |
| `CONTRACT_ID` | Deployed `stellar-save` contract ID | ✅ for indexer |
| `REDIS_URL` | Redis connection URL | ✅ |
| `ADMIN_SECRET` | Secret key for admin endpoints | ✅ |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | ✅ |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials (backups, Secrets Manager) | Optional |
| `SENDGRID_API_KEY` | Email delivery | Optional |
| `FIREBASE_PROJECT_ID` | Push notifications | Optional |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push | Optional |
| `ELASTICSEARCH_NODE` | Full-text search | Optional |
| `OTEL_TRACES_ENABLED` | OpenTelemetry tracing | Optional |

A minimal `backend/.env` for local development:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stellar_save
JWT_SECRET=local-dev-secret-change-me-min-32-chars
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL_DAYS=30
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
HORIZON_URL=https://horizon-testnet.stellar.org
CONTRACT_ID=
REDIS_URL=redis://localhost:6379
ADMIN_SECRET=local-dev-admin-secret
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=debug
```

### Frontend

```bash
cd frontend
cp .env.testnet.example .env
```

Key `VITE_*` variables (set in `frontend/.env`):

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |
| `VITE_STELLAR_NETWORK` | `TESTNET` or `PUBLIC` |
| `VITE_HORIZON_URL` | Horizon API URL |
| `VITE_CONTRACT_ID` | Deployed contract ID |

---

## 4. Run Prisma migrations

With the database running and `DATABASE_URL` set:

```bash
cd backend
npx prisma migrate dev
```

This applies all migrations under `backend/prisma/` and generates the Prisma client in `backend/src/generated/prisma`.

### Seeding (optional)

```bash
cd backend
npx prisma db seed
# or via the helper script:
../scripts/seed.sh
```

### Resetting the database

```bash
npx prisma migrate reset    # drops, recreates, and re-seeds
```

### Viewing data (Prisma Studio)

```bash
npx prisma studio
```

Opens a browser UI at `http://localhost:5555`.

---

## 5. Build and deploy the Soroban smart contract

### Install the Stellar CLI

```bash
# via Homebrew (macOS/Linux)
brew install stellar-cli

# or via cargo
cargo install stellar-cli --locked
```

Verify the install:

```bash
stellar --version
```

### Build the contract

```bash
./scripts/build.sh
# equivalent to:
cd contracts/stellar-save
cargo build --release --target wasm32-unknown-unknown
```

The compiled WASM is written to `target/wasm32-unknown-unknown/release/stellar_save.wasm`.

### Deploy to testnet

```bash
./scripts/deploy_testnet.sh
```

This uses `stellar contract deploy` and prints the deployed **Contract ID**. Copy it into `backend/.env` as `CONTRACT_ID` and `frontend/.env` as `VITE_CONTRACT_ID`.

To deploy to mainnet (requires funded account):

```bash
./scripts/deploy_mainnet.sh
```

### Configure the Stellar CLI network

```bash
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

stellar keys generate alice --network testnet --fund
```

The `environments.toml` file at the repo root also captures environment-specific config that the scripts read.

---

## 6. Start the backend

```bash
cd backend
npm run dev
```

The server starts on `http://localhost:3001`.

Endpoints to verify the setup:

| Endpoint | Expected response |
|----------|-----------------|
| `GET /api/v1/health` | `{ "status": "ok" }` |
| `GET /api/v1/ready` | `{ "status": "ready" }` |
| `POST /graphql` with `{ "query": "{ health }" }` | `{ "data": { "health": "ok" } }` |

---

## 7. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts on `http://localhost:5173`.

---

## 8. Run all tests

From the repo root:

```bash
./scripts/test.sh
```

Or per workspace:

```bash
# Smart contracts
cargo test

# Frontend (Vitest)
cd frontend && npm run test

# Backend (Jest)
cd backend && npm test
```

Coverage reports:

```bash
# Contracts
cargo tarpaulin --config tarpaulin.toml

# Frontend
cd frontend && npm run test:coverage

# Backend
cd backend && npm run test:coverage
```

---

## Troubleshooting

### `DATABASE_URL` connection refused

- Make sure the Docker containers are running: `docker compose ps`
- Check the database name and credentials match what is in `docker-compose.yml`
- Try connecting manually: `psql postgresql://postgres:postgres@localhost:5432/stellar_save`

### Prisma migration error: `Can't reach database server`

- The `DATABASE_URL` in `backend/.env` is missing or wrong.
- PostgreSQL may not have started yet — wait a few seconds and retry.

### Prisma client not generated / import errors

```bash
cd backend && npx prisma generate
```

### `cargo build` fails: `wasm32-unknown-unknown` target not installed

```bash
rustup target add wasm32-unknown-unknown
```

### Stellar CLI: `stellar` not found

Install it via `cargo install stellar-cli --locked` or `brew install stellar-cli` and confirm with `which stellar`.

### Contract deploy fails: insufficient testnet funds

Stellar testnet accounts need XLM to pay fees. Fund with:

```bash
stellar keys fund <YOUR_KEY_NAME> --network testnet
# or via Friendbot directly:
curl https://friendbot.stellar.org/?addr=<GADDRESS>
```

### Redis connection refused

- Ensure Redis is running: `docker compose up -d redis`
- Check `REDIS_URL` in `backend/.env`

### Frontend shows blank page / API errors

- Confirm `VITE_API_URL` points to the running backend (`http://localhost:3001`).
- Open the browser DevTools Network tab and check for CORS errors.
- Verify `CORS_ALLOWED_ORIGINS` in `backend/.env` includes `http://localhost:5173`.

### JWT errors in GraphQL

- Tokens expire after 15 minutes by default. Use `POST /api/auth/refresh` to rotate.
- Confirm `JWT_SECRET` is identical across all backend processes if running multiple instances.

### Port conflicts

Default ports used by the stack:

| Service | Default port |
|---------|-------------|
| Backend API | 3001 |
| Frontend dev server | 5173 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Prisma Studio | 5555 |
| Elasticsearch | 9200 |

Override the backend port with `PORT=<n>` in `backend/.env`.

---

## Related documentation

- [Root README](../../README.md)
- [Frontend README](../../frontend/README.md)
- [Backend README](../../backend/README.md) *(if present)*
- [Scripts README](../../scripts/README.md)
- [Database Migrations Guide](./database-migrations.md)
- [Deployment Guide](./deployment.md)
- [GraphQL API Reference](../api/graphql.md)
- [Troubleshooting](../troubleshooting.md)
