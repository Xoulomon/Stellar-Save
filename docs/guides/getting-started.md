# Getting Started

This guide walks you through setting up the Stellar-Save monorepo for local development. By the end you will have every workspace — contracts, backend, frontend, and mobile — ready to build, test, and run.

## Prerequisites

| Tool | Minimum version | Install |
|---|---|---|
| **Node.js** | 18 LTS | [nodejs.org](https://nodejs.org/) or `nvm install 18` |
| **pnpm** | 9.0.0 | `corepack enable && corepack prepare pnpm@9.0.0 --activate` |
| **Rust** | stable channel | [rustup.rs](https://rustup.rs/) — the repo's `rust-toolchain.toml` pins the channel |
| **wasm32-unknown-unknown** target | — | `rustup target add wasm32-unknown-unknown` |
| **Stellar CLI** | latest | `cargo install --locked stellar-cli --features opt` |
| **Docker & Docker Compose** | 24+ | [docker.com](https://www.docker.com/) — used for PostgreSQL, Redis, and Elasticsearch |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |

> **Tip:** The Rust toolchain is declared in `rust-toolchain.toml` at the repo root (`channel = "stable"`, components `rustfmt` and `clippy`, target `wasm32-unknown-unknown`). Running any `cargo` command inside the repo will auto-install the correct toolchain via rustup.

---

## 1. Clone and install

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save

# Install root + workspace dependencies and set up Husky git hooks
pnpm install
```

The root `package.json` uses **Turborepo** to orchestrate builds, tests, and linting across workspaces.

---

## 2. Environment configuration

The backend requires a `.env` file. A complete reference for every variable lives in [ENVIRONMENT.md](../../ENVIRONMENT.md).

```bash
cp .env.example backend/.env
```

At a minimum, set:

| Variable | Example value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/stellar_save` | Local Postgres |
| `JWT_SECRET` | (32+ random chars) | `openssl rand -base64 32` |
| `ADMIN_SECRET` | (any non-empty string) | |
| `REDIS_HOST` | `localhost` | |
| `STELLAR_NETWORK` | `testnet` | Default; no change needed for dev |

> **Never commit `.env` files.** They are already in `.gitignore`.

---

## 3. Start infrastructure services

PostgreSQL, Redis, and (optionally) Elasticsearch run in Docker:

```bash
docker compose up -d
```

Verify the services are running:

```bash
docker compose ps
```

---

## 4. Workspace-by-workspace setup

### Smart Contracts (Rust / Soroban)

The main contract lives in `contracts/stellar-save/`. Other contracts in the workspace are excluded to avoid dependency conflicts.

```bash
# Build the contract
cargo build --manifest-path contracts/stellar-save/Cargo.toml

# Run all library tests
cargo test --lib --manifest-path contracts/stellar-save/Cargo.toml

# Build for Soroban deployment (WASM)
cargo build --target wasm32-unknown-unknown --manifest-path contracts/stellar-save/Cargo.toml
```

Run a specific test module:

```bash
cargo test --lib pool --manifest-path contracts/stellar-save/Cargo.toml
```

Generate Rust documentation:

```bash
cargo doc --manifest-path contracts/stellar-save/Cargo.toml --open
```

### Backend (Express + NestJS hybrid)

```bash
cd backend

# Generate Prisma client from schema
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start the dev server (hot-reload)
pnpm dev
```

The server listens on the port defined by `PORT` in `.env` (default `3001`).

Run tests:

```bash
pnpm test
```

### Frontend (React + Vite)

```bash
cd frontend

# Start the dev server
pnpm dev
```

The frontend reads `VITE_*` environment variables from `frontend/.env` (see `frontend/README.md` for details).

Run tests:

```bash
pnpm test
```

### Mobile (Expo / React Native)

```bash
cd mobile

# Start the Expo dev server
pnpm start
```

Follow the on-screen instructions to open the app in iOS Simulator, Android Emulator, or Expo Go on a physical device. See `mobile/README.md` for platform-specific setup.

---

## 5. Common commands (from the repo root)

All workspaces expose the same script names, so Turborepo can run them in parallel:

```bash
pnpm build        # Build every workspace
pnpm test         # Run all test suites
pnpm lint         # Lint all workspaces
pnpm typecheck    # TypeScript type checking
pnpm format       # Format with Prettier
pnpm format:check # Verify formatting (CI)
pnpm dev          # Start all dev servers
```

---

## 6. Testing strategy

| Workspace | Framework | Mock strategy | Coverage gate |
|---|---|---|---|
| contracts | `cargo test` | — | 85% lines (cargo-tarpaulin) |
| frontend | Vitest | Shared `@stellar/stellar-sdk` mock (`frontend/src/__mocks/`) | 80% lines / 70% branches |
| backend | Jest | Shared `@stellar/stellar-sdk` mock (`backend/src/__mocks/`) | 60% lines |

Both the frontend and backend ship a **shared manual mock** for `@stellar/stellar-sdk` so unit tests are offline-first, deterministic, and consistent. See [TESTING.md](../../TESTING.md) for full details including property-based testing and mutation testing for contracts.

Run coverage locally:

```bash
# Contracts
cargo tarpaulin --config tarpaulin.toml

# Frontend
cd frontend && pnpm test:coverage

# Backend
cd backend && pnpm test:coverage
```

---

## 7. Code quality

The repo enforces quality via Husky git hooks and CI:

- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint)
- **Pre-commit** runs Prettier formatting check
- **CI** runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and coverage gates on every PR

---

## 8. Troubleshooting

| Problem | Solution |
|---|---|
| `feature 'edition2024' is required` | Build only stellar-save: `cargo build --manifest-path contracts/stellar-save/Cargo.toml` |
| `cannot find module` during cargo commands | Use the manifest path or ensure you are in the workspace root |
| Tests not running (Rust) | Add the `--lib` flag: `cargo test --lib` |
| `EADDRINUSE` on backend start | Change `PORT` in `backend/.env` |
| Database connection refused | Ensure `docker compose up -d` is running and `DATABASE_URL` is correct |
| Redis connection refused | Ensure Redis container is running: `docker compose ps` |
| Invalid environment configuration | Check the error output against [ENVIRONMENT.md](../../ENVIRONMENT.md) |

---

## Next steps

- [ENVIRONMENT.md](../../ENVIRONMENT.md) — full environment variable reference
- [BUILD_GUIDE.md](../../BUILD_GUIDE.md) — contract build commands in detail
- [TESTING.md](../../TESTING.md) — testing strategy and shared mock guide
- [CONTRIBUTING.md](../../CONTRIBUTING.md) — contribution workflow and PR guidelines
- [docs/architecture.md](../architecture.md) — system architecture overview
- [QUICK_REFERENCE.md](../../QUICK_REFERENCE.md) — smart contract API quick reference
