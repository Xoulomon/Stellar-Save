# Environment Configuration

This document describes all environment variables required by the Stellar-Save project. Configuration is validated on application startup using a Zod schema — misconfiguration fails fast with clear error messages.

## Quick Setup

1. Copy the example file:

```bash
cp .env.example backend/.env
```

2. Edit `backend/.env` with your configuration.
3. Never commit `.env` to version control (it's in `.gitignore`).

## Configuration Validation

The backend validates all environment variables on startup:

- **Location**: `backend/src/config.ts` (Zod schema)
- **Entry Point**: `backend/src/main.ts` (logs validation during bootstrap)
- **Behavior**: Fails fast with structured error messages if variables are missing or invalid
- **No Runtime Errors**: Configuration issues are caught before the server accepts traffic

If validation fails, you'll see an error message like:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": [
    "JWT_SECRET: String must contain at least 32 character(s)",
    "STELLAR_RPC_URL: Invalid url"
  ],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

---

## Environment Variables by Category

### Server & Process

| Variable    | Type                                | Default       | Required | Description                  |
| ----------- | ----------------------------------- | ------------- | -------- | ---------------------------- |
| `NODE_ENV`  | `development`, `test`, `production` | `development` | Yes      | Application environment mode |
| `PORT`      | Integer (0-65535)                   | `3001`        | No       | HTTP server port             |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error`    | `info`        | No       | Logging verbosity            |

**Example**:

```bash
NODE_ENV=production
PORT=3001
LOG_LEVEL=info
```

---

### Security & Authentication

| Variable                     | Type                       | Default                  | Required | Description                                            |
| ---------------------------- | -------------------------- | ------------------------ | -------- | ------------------------------------------------------ |
| `ADMIN_SECRET`               | String (non-empty)         | `super-secret-admin-key` | Yes      | Secret for admin routes (`x-admin-secret` header)      |
| `JWT_SECRET`                 | String (≥32 chars)         | —                        | Yes      | Secret for JWT signing (production: must be ≥32 chars) |
| `JWT_ACCESS_TOKEN_TTL`       | String (e.g., `15m`, `1h`) | `15m`                    | No       | Access token expiration time                           |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | Integer                    | `30`                     | No       | Refresh token expiration in days                       |

**Requirements**:

- `ADMIN_SECRET`: Any non-empty string, but prefer random 32+ character values in production
- `JWT_SECRET`: Must be at least 32 characters; use a cryptographically secure random string
  - Generate: `openssl rand -base64 32`

**Example**:

```bash
ADMIN_SECRET=your-random-admin-secret-here
JWT_SECRET=your-random-jwt-secret-min-32-characters-here-12345
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_TTL_DAYS=30
```

---

### Database

| Variable               | Type              | Default | Required     | Description                                                       |
| ---------------------- | ----------------- | ------- | ------------ | ----------------------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL URL    | —       | Conditional  | Direct PostgreSQL connection string (if not using component vars) |
| `DATABASE_REPLICA_URL` | PostgreSQL URL    | —       | No           | Optional read replica connection string                           |
| `DB_USERNAME`          | String            | —       | Conditional* | Database username (for Secrets Manager)                           |
| `DB_PASSWORD`          | String            | —       | Conditional* | Database password (for Secrets Manager)                           |
| `DB_HOST`              | String (hostname) | —       | Conditional* | Database server hostname                                          |
| `DB_PORT`              | Integer           | —       | Conditional* | Database server port (usually 5432)                               |
| `DB_NAME`              | String            | —       | Conditional* | Database name                                                     |

**Usage**:

- **Option A (Recommended for local)**: Set `DATABASE_URL`
  ```bash
  DATABASE_URL=postgresql://user:password@localhost:5432/stellar_save
  ```
- **Option B (ECS with Secrets Manager)**: Set all `DB_*` variables
  ```bash
  DB_USERNAME=dbuser
  DB_PASSWORD=dbpass123
  DB_HOST=rds.amazonaws.com
  DB_PORT=5432
  DB_NAME=stellar_save
  ```
- **Fallback**: If neither is provided, uses local default: `postgresql://user:pass@localhost:5432/stellar_save`

*Conditional: Either set `DATABASE_URL` OR all five `DB_*` variables. If neither is complete, local fallback is used.

---

### Stellar / Soroban

| Variable                     | Type                                            | Default                               | Required | Description                                                      |
| ---------------------------- | ----------------------------------------------- | ------------------------------------- | -------- | ---------------------------------------------------------------- |
| `STELLAR_NETWORK`            | `testnet`, `mainnet`, `futurenet`, `standalone` | `testnet`                             | No       | Stellar network to use                                           |
| `STELLAR_RPC_URL`            | URL                                             | `https://soroban-testnet.stellar.org` | No       | Soroban RPC endpoint (must be valid URL)                         |
| `STELLAR_RPC_FALLBACK_URLS`  | Comma-separated URLs                            | `""`                                  | No       | Fallback RPC endpoints (comma-separated, all must be valid URLs) |
| `STELLAR_NETWORK_PASSPHRASE` | String                                          | `Test SDF Network ; September 2015`   | No       | Network passphrase (must match network)                          |
| `CONTRACT_ID`                | String                                          | `""`                                  | No       | Deployed contract address                                        |
| `HORIZON_URL`                | URL                                             | `https://horizon-testnet.stellar.org` | No       | Horizon API endpoint for account lookups                         |

**Network Configuration**:

- **Testnet** (default): Good for development and testing
  ```bash
  STELLAR_NETWORK=testnet
  STELLAR_RPC_URL=https://soroban-testnet.stellar.org
  STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
  HORIZON_URL=https://horizon-testnet.stellar.org
  ```
- **Mainnet** (production): For live transactions
  ```bash
  STELLAR_NETWORK=mainnet
  STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
  STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
  HORIZON_URL=https://horizon.stellar.org
  ```
- **Standalone** (testing): Local test network
  ```bash
  STELLAR_NETWORK=standalone
  STELLAR_RPC_URL=http://localhost:8000/soroban/rpc
  STELLAR_NETWORK_PASSPHRASE=Standalone Network ; February 2017
  HORIZON_URL=http://localhost:8000
  ```

**RPC Fallback URLs**:

```bash
STELLAR_RPC_FALLBACK_URLS=https://rpc1.example.com, https://rpc2.example.com, https://rpc3.example.com
```

---

### Backup & Disaster Recovery

| Variable                       | Type                   | Default                | Required | Description                            |
| ------------------------------ | ---------------------- | ---------------------- | -------- | -------------------------------------- |
| `BACKUP_ENABLED`               | `true`, `false`        | `false`                | No       | Enable automated backups to S3         |
| `BACKUP_S3_BUCKET`             | String                 | `stellar-save-backups` | No       | S3 bucket for backups                  |
| `BACKUP_RETENTION_DAYS`        | Integer                | `30`                   | No       | How long to retain backups (days)      |
| `BACKUP_ALERT_WEBHOOK_URL`     | URL (optional)         | —                      | No       | Webhook URL for backup failure alerts  |
| `BACKUP_DRILL_ENABLED`         | `true`, `false`        | `false`                | No       | Enable backup restore drills (testing) |
| `BACKUP_DRILL_INTERVAL_MS`     | Integer (milliseconds) | `86400000` (24h)       | No       | How often to run restore drills        |
| `BACKUP_DRILL_MAX_DURATION_MS` | Integer (milliseconds) | `300000` (5m)          | No       | Maximum drill duration before timeout  |

**Example** (with backups enabled):

```bash
BACKUP_ENABLED=true
BACKUP_S3_BUCKET=my-company-stellar-backups
BACKUP_RETENTION_DAYS=90
BACKUP_DRILL_ENABLED=true
```

---

### AWS Configuration

| Variable                | Type   | Default     | Required | Description                                 |
| ----------------------- | ------ | ----------- | -------- | ------------------------------------------- |
| `AWS_REGION`            | String | `us-east-1` | No       | AWS region for S3, KMS, etc.                |
| `AWS_ACCESS_KEY_ID`     | String | `""`        | No       | AWS IAM access key (uses IAM role if empty) |
| `AWS_SECRET_ACCESS_KEY` | String | `""`        | No       | AWS IAM secret key (uses IAM role if empty) |

**AWS Credentials**:

- **Option A (Recommended)**: Use IAM role (no keys needed)
  - Leave `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` empty
  - Requires IAM role with appropriate permissions attached to EC2/ECS instance
- **Option B**: Explicit keys
  ```bash
  AWS_ACCESS_KEY_ID=AKIA...
  AWS_SECRET_ACCESS_KEY=wJal...
  ```

---

### Elasticsearch (Search & Analytics)

| Variable                 | Type   | Default                 | Required | Description                  |
| ------------------------ | ------ | ----------------------- | -------- | ---------------------------- |
| `ELASTICSEARCH_NODE`     | URL    | `http://localhost:9200` | No       | Elasticsearch connection URL |
| `ELASTICSEARCH_USERNAME` | String | `elastic`               | No       | Elasticsearch username       |
| `ELASTICSEARCH_PASSWORD` | String | `changeme`              | No       | Elasticsearch password       |

**Example**:

```bash
ELASTICSEARCH_NODE=https://elasticsearch.example.com:9200
ELASTICSEARCH_USERNAME=elastic_user
ELASTICSEARCH_PASSWORD=secure-password-here
```

---

### Redis (Caching & Sessions)

| Variable         | Type              | Default     | Required | Description                                |
| ---------------- | ----------------- | ----------- | -------- | ------------------------------------------ |
| `REDIS_HOST`     | String (hostname) | `localhost` | No       | Redis server hostname                      |
| `REDIS_PORT`     | Integer           | `6379`      | No       | Redis server port                          |
| `REDIS_PASSWORD` | String (optional) | —           | No       | Redis password (if authentication enabled) |

**Example** (with authentication):

```bash
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

**Example** (local development, no auth):

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

### Rate Limiting (Tiered)

| Variable                             | Type    | Default  | Required | Description                         |
| ------------------------------------ | ------- | -------- | -------- | ----------------------------------- |
| `RATE_LIMIT_FREE_REQ_PER_MIN`        | Integer | `30`     | No       | Free tier requests per minute       |
| `RATE_LIMIT_FREE_REQ_PER_HOUR`       | Integer | `500`    | No       | Free tier requests per hour         |
| `RATE_LIMIT_PRO_REQ_PER_MIN`         | Integer | `300`    | No       | Pro tier requests per minute        |
| `RATE_LIMIT_PRO_REQ_PER_HOUR`        | Integer | `10000`  | No       | Pro tier requests per hour          |
| `RATE_LIMIT_ENTERPRISE_REQ_PER_MIN`  | Integer | `3000`   | No       | Enterprise tier requests per minute |
| `RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR` | Integer | `100000` | No       | Enterprise tier requests per hour   |

**Example** (conservative limits for small deployment):

```bash
RATE_LIMIT_FREE_REQ_PER_MIN=10
RATE_LIMIT_FREE_REQ_PER_HOUR=100
RATE_LIMIT_PRO_REQ_PER_MIN=100
RATE_LIMIT_PRO_REQ_PER_HOUR=5000
```

---

### Email (SendGrid)

| Variable              | Type          | Default                    | Required | Description                        |
| --------------------- | ------------- | -------------------------- | -------- | ---------------------------------- |
| `SENDGRID_API_KEY`    | String        | `""`                       | No       | SendGrid API key for sending email |
| `SENDGRID_FROM_EMAIL` | Email address | `noreply@stellar-save.com` | No       | Sender email address               |
| `SENDGRID_REPLY_TO`   | Email address | `support@stellar-save.com` | No       | Reply-to email address             |

**Example**:

```bash
SENDGRID_API_KEY=SG.XXXXXXXXXXXXXXXXXXX
SENDGRID_FROM_EMAIL=noreply@mycompany.com
SENDGRID_REPLY_TO=support@mycompany.com
```

---

### Push Notifications

| Variable                   | Type                    | Default    | Required     | Description                   |
| -------------------------- | ----------------------- | ---------- | ------------ | ----------------------------- |
| `PUSH_PROVIDER`            | `firebase`, `onesignal` | `firebase` | No           | Push notification provider    |
| `FIREBASE_PROJECT_ID`      | String                  | —          | Conditional* | Firebase project ID           |
| `FIREBASE_SERVICE_ACCOUNT` | String (JSON)           | —          | Conditional* | Firebase service account JSON |
| `ONESIGNAL_APP_ID`         | String                  | —          | Conditional* | OneSignal app ID              |
| `ONESIGNAL_API_KEY`        | String                  | —          | Conditional* | OneSignal API key             |

**Firebase** (Google Cloud):

```bash
PUSH_PROVIDER=firebase
FIREBASE_PROJECT_ID=my-firebase-project
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

**OneSignal**:

```bash
PUSH_PROVIDER=onesignal
ONESIGNAL_APP_ID=12345678-abcd-1234-abcd-1234567890ab
ONESIGNAL_API_KEY=ZjcxZjI0OWQtYjcwMi00ZTYwLWI1ZWQtMDAwMDAwMDAwMDAw
```

*Conditional: Set either Firebase OR OneSignal variables depending on `PUSH_PROVIDER`.

---

### Web Push (VAPID)

| Variable            | Type          | Default                           | Required | Description                    |
| ------------------- | ------------- | --------------------------------- | -------- | ------------------------------ |
| `VAPID_PUBLIC_KEY`  | String        | `""`                              | No       | VAPID public key for web push  |
| `VAPID_PRIVATE_KEY` | String        | `""`                              | No       | VAPID private key for web push |
| `VAPID_SUBJECT`     | Email address | `mailto:noreply@stellar-save.com` | No       | VAPID subject (contact email)  |

**Generate VAPID Keys**:

```bash
npm install -g web-push
web-push generate-vapid-keys
# Output:
# Public Key: ...
# Private Key: ...
```

---

### Distributed Tracing (OpenTelemetry)

| Variable                      | Type            | Default                 | Required | Description                         |
| ----------------------------- | --------------- | ----------------------- | -------- | ----------------------------------- |
| `OTEL_TRACES_ENABLED`         | `true`, `false` | `false`                 | No       | Enable distributed tracing          |
| `OTEL_SERVICE_NAME`           | String          | `stellar-save-backend`  | No       | Service name in traces              |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL             | `http://localhost:4318` | No       | OpenTelemetry collector endpoint    |
| `OTEL_TRACES_SAMPLER_ARG`     | Float (0-1)     | `0.1`                   | No       | Trace sampling rate (0=none, 1=all) |

**Example** (with Jaeger):

```bash
OTEL_TRACES_ENABLED=true
OTEL_SERVICE_NAME=stellar-save-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger-collector:4318
OTEL_TRACES_SAMPLER_ARG=0.1
```

---

### Soroban Connection Pool

| Variable                  | Type                   | Default | Required | Description          |
| ------------------------- | ---------------------- | ------- | -------- | -------------------- |
| `SOROBAN_POOL_SIZE`       | Integer                | `5`     | No       | Connection pool size |
| `SOROBAN_POOL_TIMEOUT_MS` | Integer (milliseconds) | `5000`  | No       | Connection timeout   |

---

### RPC Circuit Breaker

| Variable                              | Type            | Default | Required | Description                                |
| ------------------------------------- | --------------- | ------- | -------- | ------------------------------------------ |
| `RPC_BREAKER_TIMEOUT_MS`              | Integer         | `8000`  | No       | Circuit breaker timeout                    |
| `RPC_BREAKER_ERROR_THRESHOLD_PCT`     | Integer (0-100) | `50`    | No       | Error threshold percentage to trip breaker |
| `RPC_BREAKER_RESET_TIMEOUT_MS`        | Integer         | `15000` | No       | Time before attempting recovery            |
| `RPC_BREAKER_VOLUME_THRESHOLD`        | Integer         | `5`     | No       | Minimum requests before tripping           |
| `RPC_BREAKER_STALE_CACHE_TTL_SECONDS` | Integer         | `300`   | No       | Stale cache timeout                        |

---

### Indexer (Contract Events)

| Variable          | Type            | Default | Required | Description                    |
| ----------------- | --------------- | ------- | -------- | ------------------------------ |
| `INDEXER_ENABLED` | `true`, `false` | `false` | No       | Enable contract event indexing |

---

### On-Chain Monitor

| Variable                                  | Type             | Default        | Required | Description                            |
| ----------------------------------------- | ---------------- | -------------- | -------- | -------------------------------------- |
| `ON_CHAIN_MONITOR_ENABLED`                | `true`, `false`  | `false`        | No       | Enable on-chain transaction monitoring |
| `ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS` | String (integer) | `100000000000` | No       | Large payout threshold in stroops      |

---

### Fraud Detection

| Variable                            | Type            | Default | Required | Description                          |
| ----------------------------------- | --------------- | ------- | -------- | ------------------------------------ |
| `FRAUD_DETECTION_ENABLED`           | `true`, `false` | `true`  | No       | Enable fraud detection engine        |
| `FRAUD_SYBIL_THRESHOLD`             | Integer         | `3`     | No       | Sybil detection threshold            |
| `FRAUD_RAPID_CYCLE_HOURS`           | Integer         | `24`    | No       | Rapid cycle detection window (hours) |
| `FRAUD_CONTRIBUTION_OUTLIER_FACTOR` | Float           | `3`     | No       | Outlier detection multiplier         |
| `FRAUD_SCAN_INTERVAL_MINUTES`       | Integer         | `60`    | No       | How often to scan for fraud          |

---

### KYC (Know Your Customer)

| Variable             | Type   | Default                                    | Required | Description                      |
| -------------------- | ------ | ------------------------------------------ | -------- | -------------------------------- |
| `KYC_PROVIDER_URL`   | URL    | `https://sandbox.kyc-provider.example.com` | No       | KYC provider API endpoint        |
| `KYC_WEBHOOK_SECRET` | String | `""`                                       | No       | Secret for KYC provider webhooks |

---

### IPFS (InterPlanetary File System)

| Variable                     | Type            | Default                 | Required | Description                           |
| ---------------------------- | --------------- | ----------------------- | -------- | ------------------------------------- |
| `IPFS_ENABLED`               | `true`, `false` | `false`                 | No       | Enable IPFS for decentralized storage |
| `IPFS_API_URL`               | URL             | `http://localhost:5001` | No       | IPFS node API endpoint                |
| `IPFS_API_TIMEOUT_MS`        | Integer         | `30000`                 | No       | IPFS request timeout                  |
| `IPFS_GATEWAY_URL`           | URL             | `http://localhost:8080` | No       | IPFS gateway for retrieving content   |
| `IPFS_PIN_RETRY_COUNT`       | Integer         | `3`                     | No       | Retry attempts for pinning            |
| `IPFS_PIN_CHECK_INTERVAL_MS` | Integer         | `5000`                  | No       | Check interval for pin status         |
| `IPFS_MONITOR_INTERVAL_MS`   | Integer         | `60000`                 | No       | Node health check interval            |

---

### Privacy & GDPR

| Variable             | Type    | Default | Required | Description                                            |
| -------------------- | ------- | ------- | -------- | ------------------------------------------------------ |
| `PII_RETENTION_DAYS` | Integer | `365`   | No       | How long to retain personally identifiable information |

---

### CORS & Frontend URLs

| Variable               | Type                 | Default                    | Required | Description                            |
| ---------------------- | -------------------- | -------------------------- | -------- | -------------------------------------- |
| `CORS_ALLOWED_ORIGINS` | Comma-separated URLs | `""`                       | No       | Allowed CORS origins (comma-separated) |
| `FRONTEND_URL`         | URL                  | `https://stellar-save.com` | No       | Frontend application URL               |
| `APP_URL`              | URL                  | `https://stellar-save.com` | No       | App download/landing page URL          |

**Example**:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000, https://app.example.com, https://www.example.com
FRONTEND_URL=https://app.example.com
APP_URL=https://example.com/app
```

---

### Optional Features

| Variable                    | Type            | Default       | Required | Description                             |
| --------------------------- | --------------- | ------------- | -------- | --------------------------------------- |
| `KEEPER_ENABLED`            | `true`, `false` | `false`       | No       | Enable keeper service (automated tasks) |
| `KEEPER_SCHEDULE`           | Cron expression | `*/5 * * * *` | No       | Keeper job schedule                     |
| `ANALYTICS_RESYNC_ENABLED`  | `true`, `false` | `false`       | No       | Enable periodic analytics resync        |
| `ANALYTICS_RESYNC_SCHEDULE` | Cron expression | `0 * * * *`   | No       | Analytics resync schedule               |
| `CAPTCHA_SECRET_KEY`        | String          | —             | No       | CAPTCHA provider secret (if using)      |

---

### TLS/SSL

| Variable        | Type      | Default | Required | Description                  |
| --------------- | --------- | ------- | -------- | ---------------------------- |
| `TLS_KEY_PATH`  | File path | —       | No       | Path to TLS private key file |
| `TLS_CERT_PATH` | File path | —       | No       | Path to TLS certificate file |

---

## Complete `.env.example` Template

See `.env.example` in the project root for a complete working example. Use it as your configuration template:

```bash
cp .env.example backend/.env
# Edit backend/.env with your values
```

---

## Security Best Practices

✅ **DO**:

- Keep `.env` in `.gitignore` (never commit secrets)
- Use strong, random values for `JWT_SECRET` and `ADMIN_SECRET`
- Rotate secrets regularly in production
- Use AWS Secrets Manager or similar for production deployments
- Store `.env` file securely with restricted file permissions (`chmod 600`)
- Use environment-specific configurations for dev/staging/production

❌ **DON'T**:

- Commit `.env` files to version control
- Use placeholder/default values in production
- Reuse the same secret across environments
- Log sensitive values (JWT_SECRET, passwords, API keys)
- Embed secrets in Docker images

---

## Troubleshooting

### "Invalid environment configuration" error on startup

This means the Zod schema validation failed. Check the error output for specific issues:

- Missing required variables
- Invalid URL format
- Non-numeric value for numeric field
- Enum value not in allowed list

Example:

```
"issues": ["JWT_SECRET: String must contain at least 32 character(s)"]
```

**Fix**: Update your `.env` file and restart the application.

### PORT already in use

If you get "EADDRINUSE", the port is already in use. Change it:

```bash
PORT=3002
```

### Database connection refused

Check your `DATABASE_URL` or `DB_*` variables and ensure:

- PostgreSQL is running
- Hostname/port are correct
- Username/password are correct
- Database exists

### Redis connection refused

Check `REDIS_HOST` and `REDIS_PORT` and ensure:

- Redis server is running
- Hostname/port are correct
- Password is correct (if required)

---

## Environment Detection

The application automatically detects the environment from `NODE_ENV`:

- `development`: Uses relaxed defaults, verbose logging
- `test`: Uses in-memory databases, mocked services
- `production`: Enforces strict validation, minimal logging

Recommended settings by environment:

**Development**:

```bash
NODE_ENV=development
LOG_LEVEL=debug
BACKUP_ENABLED=false
```

**Production**:

```bash
NODE_ENV=production
LOG_LEVEL=info
BACKUP_ENABLED=true
JWT_SECRET=<32+ char random>
ADMIN_SECRET=<32+ char random>
```

---

## Further Reading

- Configuration Validation: `backend/src/config.ts`
- Tests: `backend/src/tests/config.test.ts`
- Network Configs: `environments.toml`
- Canary Tests: `canary.toml`
