# Environment Configuration

This document describes all environment variables and network configurations for the Stellar-Save project.

## Quick Setup

1. Copy the example file:
```bash
cp backend/.env.example backend/.env
```

2. Edit `.env` with your configuration.
3. Never commit `.env` to version control.

## Active Environment Variables

### Core Server & Security

| Variable | Description | Default | Required in Prod |
|----------|-------------|---------|------------------|
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` | Yes |
| `PORT` | HTTP port for the backend server | `3001` | Yes |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` | No |
| `ADMIN_SECRET` | Header secret for admin routes (`x-admin-secret`) | `super-secret-admin-key` | Yes |
| `JWT_SECRET` | Secret key for JWT signing (minimum 32 characters) | — | Yes |
| `JWT_ACCESS_TOKEN_TTL` | Access token lifespan | `15m` | No |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | Refresh token lifespan in days | `30` | No |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `""` | Yes |

### Database & Storage

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/stellar_save` |
| `DATABASE_REPLICA_URL` | Optional PostgreSQL read replica connection string | — |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Component DB settings for ECS/Secrets Manager | — |

### Stellar & Soroban

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_NETWORK` | Network name (`testnet`, `mainnet`, `futurenet`, `standalone`) | `testnet` |
| `STELLAR_RPC_URL` | Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `STELLAR_NETWORK_PASSPHRASE` | Network passphrase | `Test SDF Network ; September 2015` |
| `SOROBAN_POOL_SIZE` | RPC connection pool size | `5` |
| `SOROBAN_POOL_TIMEOUT_MS` | RPC timeout in ms | `5000` |

### Email & Push Notifications

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API Key for transactional email delivery |
| `SENDGRID_FROM_EMAIL` | Sender email address |
| `SENDGRID_REPLY_TO` | Reply-to email address |
| `PUSH_PROVIDER` | Push notification provider (`firebase` or `onesignal`) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` | Firebase configuration for push notifications |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` | OneSignal configuration |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push VAPID credentials |

### Redis & Caching

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Optional Redis password | — |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |

### Distributed Tracing & Observability

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_TRACES_ENABLED` | Enable OpenTelemetry tracing (`true`/`false`) | `false` |
| `OTEL_SERVICE_NAME` | OpenTelemetry service identifier | `stellar-save-backend` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP collector endpoint | `http://localhost:4318` |

### Frontend Configuration (Vite)

Variables prefixed with `VITE_` are bundled into the client build:

| Variable | Description |
|----------|-------------|
| `VITE_STELLAR_NETWORK` | Network name for frontend |
| `VITE_STELLAR_RPC_URL` | Soroban RPC endpoint for frontend |

## Network Settings (`environments.toml`)

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

## Security Notes

- ✅ `.env` is listed in `.gitignore` — never commit secrets.
- ✅ Use `.env.example` as a safe configuration template.
- ⚠️ Ensure `JWT_SECRET` is at least 32 characters in production environments.
