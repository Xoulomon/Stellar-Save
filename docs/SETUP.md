# Monorepo developer setup

This is the canonical local setup guide for Stellar-Save. Component-specific
instructions remain in the frontend and backend READMEs. CI currently uses
Node.js 20, the repository-pinned pnpm 9.0.0, and the stable Rust toolchain
selected by `rust-toolchain.toml`.

## Prerequisites

- Git
- Node.js 20 and Corepack
- Rustup and Cargo (the repository toolchain file selects stable and installs
  `rustfmt`, `clippy`, and `wasm32-unknown-unknown`)
- Docker Engine/Desktop with the Docker Compose v2 plugin (optional, for the
  containerized stack)
- Stellar CLI (optional, for contract deployment)

## Clone and install

```sh
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save
corepack enable
pnpm install --frozen-lockfile
```

The root `package.json` pins pnpm 9.0.0 and `pnpm-lock.yaml` is the package
lockfile. Use pnpm for JavaScript workspace commands; do not run `npm install`
or `yarn` in the workspace.

Check the selected toolchains:

```sh
node --version       # CI uses Node.js 20
pnpm --version       # 9.0.0
rustc --version      # selected by rust-toolchain.toml
cargo --version
```

On Windows PowerShell, enable Corepack and copy environment files with:

```powershell
corepack enable
Copy-Item .env.example .env
```

## Environment

Copy the root `.env.example` to `.env` and set values needed for your chosen
services. The sample values are for local development; never commit secrets or
use the sample credentials in production. Network options are documented in
`environments.toml`. Frontend `VITE_*` values are embedded at build time.

## Start the local stack with Docker

From the repository root:

```sh
docker compose up --build
```

The Compose file starts Postgres, Redis, a local Stellar Quickstart node, the
backend, frontend, IPFS, and the seed service. The mapped local endpoints are:

| Service | Address |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:3001 |
| Stellar Quickstart / Horizon | http://localhost:8000 |
| Postgres | `localhost:5432` |
| Redis | `localhost:6379` |
| IPFS API / gateway | http://localhost:5001 / http://localhost:8080 |

Stop containers without deleting local database data with `docker compose down`.
Use `docker compose down --volumes` only when you intend to delete persisted
container data. Docker's Quickstart service is a standalone local network, not
testnet or mainnet.

## Build and test

Run commands from the repository root unless noted:

```sh
# JavaScript workspace build, tests, and lint
pnpm build
pnpm test
pnpm lint

# Focused workspace checks
pnpm --filter stellar-save-frontend test --run
pnpm --filter backend test --runInBand

# Soroban contract tests and WASM build
cargo test -p stellar-save
cargo build -p stellar-save --target wasm32-unknown-unknown --release
```

Some checks require Docker services, network access, or optional tools. The
component guides describe their focused workflows: [frontend](../frontend/README.md),
[backend](../backend/README.md), and
[contract quick reference](reference/quick-reference.md).

## Troubleshooting

- If `pnpm` is unavailable, run `corepack enable`, reopen the terminal, then
  check `pnpm --version`.
- The first Cargo command may download the Rust toolchain and dependencies. If
  the WASM target is missing, run `rustup target add wasm32-unknown-unknown`.
- If Compose reports a port conflict, stop the process using that port or adjust
  the corresponding port mapping in `docker-compose.yml`.
- For a clean container restart without losing data, use `docker compose down`
  followed by `docker compose up --build`; avoid `--volumes` unless data removal
  is intended.
