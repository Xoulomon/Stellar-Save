# Backend environment configuration

The backend validates its environment with the Zod schema in
[`src/config.ts`](../src/config.ts) at startup. This matrix documents the schema defaults and
validation rules; update it alongside that schema. Copy [`backend/.env.example`](../.env.example)
for a starting point.

All variables have schema defaults or are optional, so none are required by the schema itself.
That does not mean every integration works without credentials: provide the relevant secrets and
service URLs when enabling an integration. In particular, replace the development defaults for
`ADMIN_SECRET`, `JWT_SECRET`, and `ELASTICSEARCH_PASSWORD` before production deployment.

## Server, database, and security

| Variable | Default / validation |
| --- | --- |
| `NODE_ENV` | `development`; `development`, `test`, or `production` |
| `PORT` | `3001`; digits, converted to a number |
| `DATABASE_URL` | Optional valid URL; takes precedence over database components |
| `DATABASE_REPLICA_URL` | Optional valid URL |
| `DB_USERNAME` | Optional; used to construct `DATABASE_URL` when all `DB_*` components are set |
| `DB_PASSWORD` | Optional; used to construct `DATABASE_URL` when all `DB_*` components are set |
| `DB_HOST` | Optional; used to construct `DATABASE_URL` when all `DB_*` components are set |
| `DB_PORT` | Optional; used to construct `DATABASE_URL` when all `DB_*` components are set |
| `DB_NAME` | Optional; used to construct `DATABASE_URL` when all `DB_*` components are set |
| `ADMIN_SECRET` | `super-secret-admin-key`; non-empty string |
| `JWT_SECRET` | `stellar-save-jwt-secret-change-in-production-min32chars`; at least 32 characters |
| `JWT_ACCESS_TOKEN_TTL` | `15m`; string passed to JWT expiry configuration |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | `30`; digits, converted to a number |
| `PII_RETENTION_DAYS` | `365`; digits, converted to a number |

`DATABASE_URL` wins when present. Otherwise, all five `DB_*` components are combined; if any are
missing, the local fallback is `postgresql://user:pass@localhost:5432/stellar_save`.

## Stellar and Soroban

| Variable | Default / validation |
| --- | --- |
| `STELLAR_NETWORK` | `testnet`; `testnet`, `mainnet`, `futurenet`, or `standalone` |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org`; valid URL |
| `STELLAR_RPC_FALLBACK_URLS` | Empty; comma-separated valid URLs |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `SOROBAN_POOL_SIZE` | `5`; digits, converted to a number |
| `SOROBAN_POOL_TIMEOUT_MS` | `5000`; digits, converted to a number |
| `RPC_BREAKER_TIMEOUT_MS` | `8000`; digits, converted to a number |
| `RPC_BREAKER_ERROR_THRESHOLD_PCT` | `50`; digits, converted to a number |
| `RPC_BREAKER_RESET_TIMEOUT_MS` | `15000`; digits, converted to a number |
| `RPC_BREAKER_VOLUME_THRESHOLD` | `5`; digits, converted to a number |
| `RPC_BREAKER_STALE_CACHE_TTL_SECONDS` | `300`; digits, converted to a number |
| `HORIZON_URL` | `https://horizon-testnet.stellar.org`; valid URL |
| `CONTRACT_ID` | Empty string |
| `INDEXER_ENABLED` | `false`; `true` or `false` |

## Backups and AWS

| Variable | Default / validation |
| --- | --- |
| `BACKUP_ENABLED` | `false`; `true` or `false` |
| `BACKUP_S3_BUCKET` | `stellar-save-backups` |
| `BACKUP_RETENTION_DAYS` | `30`; digits, converted to a number |
| `BACKUP_ALERT_WEBHOOK_URL` | Empty or a valid URL |
| `BACKUP_DRILL_ENABLED` | `false`; `true` or `false` |
| `BACKUP_DRILL_INTERVAL_MS` | `86400000`; digits, converted to a number |
| `BACKUP_DRILL_MAX_DURATION_MS` | `300000`; digits, converted to a number |
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Empty string |
| `AWS_SECRET_ACCESS_KEY` | Empty string |

## Search, cache, and API URLs

| Variable | Default / validation |
| --- | --- |
| `ELASTICSEARCH_NODE` | `http://localhost:9200`; valid URL |
| `ELASTICSEARCH_USERNAME` | `elastic` |
| `ELASTICSEARCH_PASSWORD` | `changeme` |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379`; digits, converted to a number |
| `REDIS_PASSWORD` | Optional |
| `REDIS_URL` | Optional |
| `CORS_ALLOWED_ORIGINS` | Empty; comma-separated origins, trimmed; empty entries ignored |
| `FRONTEND_URL` | `https://stellar-save.com`; valid URL |
| `APP_URL` | `https://stellar-save.com`; valid URL |

## Email, push, and identity services

| Variable | Default / validation |
| --- | --- |
| `KYC_PROVIDER_URL` | `https://sandbox.kyc-provider.example.com`; valid URL |
| `KYC_WEBHOOK_SECRET` | Empty string |
| `SENDGRID_API_KEY` | Empty string |
| `SENDGRID_FROM_EMAIL` | `noreply@stellar-save.com`; valid email |
| `SENDGRID_REPLY_TO` | `support@stellar-save.com`; valid email |
| `PUSH_PROVIDER` | `firebase`; `firebase` or `onesignal` |
| `FIREBASE_PROJECT_ID` | Optional |
| `FIREBASE_SERVICE_ACCOUNT` | Optional |
| `ONESIGNAL_APP_ID` | Optional |
| `ONESIGNAL_API_KEY` | Optional |
| `VAPID_PUBLIC_KEY` | Empty string |
| `VAPID_PRIVATE_KEY` | Empty string |
| `VAPID_SUBJECT` | `mailto:noreply@stellar-save.com` |
| `CAPTCHA_SECRET_KEY` | Optional |
| `APNS_KEY_ID` | Optional |
| `APNS_TEAM_ID` | Optional |
| `APNS_KEY` | Optional |
| `APNS_BUNDLE_ID` | Optional |

## Scheduled jobs, limits, and monitoring

| Variable | Default / validation |
| --- | --- |
| `KEEPER_ENABLED` | `false`; `true` or `false` |
| `KEEPER_SCHEDULE` | `*/5 * * * *` |
| `RATE_LIMIT_FREE_REQ_PER_MIN` | `30`; digits, converted to a number |
| `RATE_LIMIT_FREE_REQ_PER_HOUR` | `500`; digits, converted to a number |
| `RATE_LIMIT_PRO_REQ_PER_MIN` | `300`; digits, converted to a number |
| `RATE_LIMIT_PRO_REQ_PER_HOUR` | `10000`; digits, converted to a number |
| `RATE_LIMIT_ENTERPRISE_REQ_PER_MIN` | `3000`; digits, converted to a number |
| `RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR` | `100000`; digits, converted to a number |
| `OTEL_TRACES_ENABLED` | `false`; `true` or `false` |
| `OTEL_SERVICE_NAME` | `stellar-save-backend` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` |
| `OTEL_TRACES_SAMPLER_ARG` | `0.1`; decimal number |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Empty or a valid URL |
| `LOG_LEVEL` | `info`; `debug`, `info`, `warn`, or `error` |
| `SERVICE_NAME` | `stellar-save-backend` |
| `SERVICE_VERSION` | `1.0.0` |

## On-chain monitoring, fraud, governance, and analytics

| Variable | Default / validation |
| --- | --- |
| `ON_CHAIN_MONITOR_ENABLED` | `false`; `true` or `false` |
| `ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS` | `100000000000`; digits, converted to `bigint` in config |
| `FRAUD_DETECTION_ENABLED` | `true`; `true` or `false` |
| `FRAUD_SYBIL_THRESHOLD` | `3`; digits, converted to a number |
| `FRAUD_RAPID_CYCLE_HOURS` | `24`; digits, converted to a number |
| `FRAUD_CONTRIBUTION_OUTLIER_FACTOR` | `3`; decimal number |
| `FRAUD_SCAN_INTERVAL_MINUTES` | `60`; digits, converted to a number |
| `ANALYTICS_RESYNC_ENABLED` | `false`; `true` or `false` |
| `ANALYTICS_RESYNC_SCHEDULE` | `0 * * * *` |
| `GOVERNOR_ADDRESSES` | Empty; comma-separated addresses, trimmed; empty entries ignored |

## TLS and IPFS

| Variable | Default / validation |
| --- | --- |
| `TLS_KEY_PATH` | Optional |
| `TLS_CERT_PATH` | Optional |
| `IPFS_ENABLED` | `false`; `true` or `false` |
| `IPFS_API_URL` | `http://localhost:5001`; valid URL |
| `IPFS_API_TIMEOUT_MS` | `30000`; digits, converted to a number |
| `IPFS_GATEWAY_URL` | `http://localhost:8080`; valid URL |
| `IPFS_PIN_RETRY_COUNT` | `3`; digits, converted to a number |
| `IPFS_PIN_CHECK_INTERVAL_MS` | `5000`; digits, converted to a number |
| `IPFS_MONITOR_INTERVAL_MS` | `60000`; digits, converted to a number |
