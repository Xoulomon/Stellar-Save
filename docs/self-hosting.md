# Self-Hosting Guide

This guide covers deploying your own instance of Stellar-Save — the backend API, frontend, and supporting services. For smart contract deployment to the Stellar network, see [deployment.md](./deployment.md).

**Version**: 1.0.0  
**Last Updated**: 2026-04-26

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Deployment](#step-by-step-deployment)
   - [1. Clone and Configure](#1-clone-and-configure)
   - [2. Deploy the Backend API](#2-deploy-the-backend-api)
   - [3. Deploy Elasticsearch](#3-deploy-elasticsearch)
   - [4. Build and Serve the Frontend](#4-build-and-serve-the-frontend)
   - [5. Deploy Smart Contracts](#5-deploy-smart-contracts)
5. [Configuration Reference](#configuration-reference)
6. [Security Hardening](#security-hardening)
7. [Monitoring and Backups](#monitoring-and-backups)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

A self-hosted Stellar-Save instance has four components:

```
Users
  │
  ▼
[Frontend]  React SPA (Vite build, served as static files)  ← repo root
  │
  ▼
[Backend API]  Node.js/Express + Apollo GraphQL  (port 3001)  ← backend/
  │         │
  │         └──► [Elasticsearch]  Search index  (port 9200)
  │
  ▼
[Stellar Network]  Soroban smart contracts (testnet or mainnet)
```

The frontend talks directly to the Stellar network for wallet operations and to your backend API for recommendations, search, exports, and admin features.

A pre-built monitoring stack (Prometheus + Grafana + ELK) lives in `monitoring/` and can be brought up with a single `docker compose` command — covered in [Monitoring and Backups](#monitoring-and-backups).

---

## Infrastructure Requirements

### Minimum (single server)

| Resource | Minimum          | Recommended      |
| -------- | ---------------- | ---------------- |
| CPU      | 2 vCPU           | 4 vCPU           |
| RAM      | 4 GB             | 8 GB             |
| Disk     | 20 GB SSD        | 50 GB SSD        |
| OS       | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Network  | 10 Mbps          | 100 Mbps         |

> Elasticsearch is the most memory-hungry component. If RAM is tight, allocate at least 2 GB to the JVM heap (`ES_JAVA_OPTS=-Xms2g -Xmx2g`).

### Ports to open

| Port     | Service               | Exposure      |
| -------- | --------------------- | ------------- |
| 80 / 443 | Reverse proxy (nginx) | Public        |
| 3001     | Backend API           | Internal only |
| 9200     | Elasticsearch         | Internal only |

### External dependencies

- A funded Stellar account for contract deployment (see [deployment.md](./deployment.md))
- (Optional) AWS S3 bucket for automated backups
- (Optional) SMTP server or email relay for notifications

---

## Prerequisites

Install these on your server before proceeding.

### Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should print v20.x.x
```

### Rust + WASM target (for contract builds)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
```

### Stellar CLI

```bash
cargo install --locked stellar-cli
stellar --version
```

### Elasticsearch 8.x

```bash
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update && sudo apt-get install -y elasticsearch
```

### nginx (reverse proxy)

```bash
sudo apt-get install -y nginx
```

---

## Step-by-Step Deployment

### 1. Clone and Configure

```bash
git clone https://github.com/Xoulomon/Stellar-Save.git
cd Stellar-Save
cp .env.example .env
```

Edit `.env` with your values. At minimum, set:

```bash
# Which Stellar network to use
STELLAR_NETWORK=mainnet
STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"

# Contract address (fill in after deploying the contract)
CONTRACT_STELLAR_SAVE=

# Backend
NODE_ENV=production
PORT=3001
ADMIN_SECRET=<generate a strong random secret>

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=<your-es-password>

# Backups (optional)
BACKUP_ENABLED=false
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
BACKUP_S3_BUCKET=stellar-save-backups
BACKUP_RETENTION_DAYS=30
BACKUP_ALERT_WEBHOOK_URL=
```

Generate a strong `ADMIN_SECRET`:

```bash
openssl rand -hex 32
```

### 2. Deploy the Backend API

#### Install dependencies

```bash
cd backend
npm install --omit=dev
```

#### Run as a systemd service

Create `/etc/systemd/system/stellar-save-api.service`:

```ini
[Unit]
Description=Stellar-Save Backend API
After=network.target elasticsearch.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/stellar-save/backend
EnvironmentFile=/opt/stellar-save/.env
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> Replace `/opt/stellar-save` with your actual clone path.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable stellar-save-api
sudo systemctl start stellar-save-api
sudo systemctl status stellar-save-api
```

Verify it's running:

```bash
curl http://localhost:3001/api/v1/health
```

### 3. Deploy Elasticsearch

#### Configure Elasticsearch

Edit `/etc/elasticsearch/elasticsearch.yml`:

```yaml
cluster.name: stellar-save
node.name: node-1
network.host: 127.0.0.1 # bind to localhost only
http.port: 9200
xpack.security.enabled: true
xpack.security.http.ssl.enabled: false # TLS handled by nginx
```

Set the JVM heap (half your available RAM, max 31 GB):

```bash
# /etc/elasticsearch/jvm.options.d/heap.options
-Xms2g
-Xmx2g
```

Start Elasticsearch and set the `elastic` user password:

```bash
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
sudo /usr/share/elasticsearch/bin/elasticsearch-reset-password -u elastic
```

Update `ELASTICSEARCH_PASSWORD` in your `.env` with the generated password, then restart the API:

```bash
sudo systemctl restart stellar-save-api
```

### 4. Build and Serve the Frontend

The frontend source and `vite.config.ts` live at the repo root, not in a subdirectory.

#### Build

```bash
# From the repo root
cp .env.example .env.production
```

Edit `.env.production`:

```bash
VITE_STELLAR_NETWORK=mainnet
VITE_STELLAR_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm
VITE_CONTRACT_STELLAR_SAVE=<your-contract-id>
```

```bash
npm install
npm run build
```

The output lands in `dist/` at the repo root.

#### Serve with nginx

Create `/etc/nginx/sites-available/stellar-save`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Frontend static files (built to dist/ at repo root)
    root /opt/stellar-save/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # GraphQL endpoint
    location /graphql {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }

    # Metrics — internal only, not exposed publicly
    location /metrics {
        proxy_pass http://127.0.0.1:3001;
        allow 127.0.0.1;
        deny all;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/stellar-save /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### TLS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 5. Deploy Smart Contracts

Follow [deployment.md](./deployment.md) for the full contract deployment process. Once you have a contract ID, update `CONTRACT_STELLAR_SAVE` in `.env` and `VITE_CONTRACT_STELLAR_SAVE` in the frontend build, then rebuild the frontend.

---

## Configuration Reference

All configuration is driven by environment variables in `.env`. Here's the full reference:

| Variable                     | Required   | Default                  | Description                                  |
| ---------------------------- | ---------- | ------------------------ | -------------------------------------------- |
| `STELLAR_NETWORK`            | Yes        | `testnet`                | `testnet`, `mainnet`, or `standalone`        |
| `STELLAR_RPC_URL`            | Yes        | testnet URL              | Soroban RPC endpoint                         |
| `STELLAR_NETWORK_PASSPHRASE` | Yes        | testnet passphrase       | Network passphrase                           |
| `CONTRACT_STELLAR_SAVE`      | Yes        | —                        | Deployed contract address                    |
| `NODE_ENV`                   | Yes        | `development`            | Set to `production` for live deployments     |
| `PORT`                       | No         | `3001`                   | Backend API port                             |
| `ADMIN_SECRET`               | Yes        | `super-secret-admin-key` | Secret for admin API endpoints — change this |
| `ELASTICSEARCH_NODE`         | No         | `http://localhost:9200`  | Elasticsearch URL                            |
| `ELASTICSEARCH_USERNAME`     | No         | `elastic`                | Elasticsearch user                           |
| `ELASTICSEARCH_PASSWORD`     | No         | `changeme`               | Elasticsearch password — change this         |
| `BACKUP_ENABLED`             | No         | `false`                  | Enable automated S3 backups                  |
| `AWS_REGION`                 | If backups | `us-east-1`              | AWS region for S3                            |
| `AWS_ACCESS_KEY_ID`          | If backups | —                        | AWS access key                               |
| `AWS_SECRET_ACCESS_KEY`      | If backups | —                        | AWS secret key                               |
| `BACKUP_S3_BUCKET`           | If backups | `stellar-save-backups`   | S3 bucket name                               |
| `BACKUP_RETENTION_DAYS`      | No         | `30`                     | Days to keep backups                         |
| `BACKUP_ALERT_WEBHOOK_URL`   | No         | —                        | Webhook URL for backup alerts                |

---

## Security Hardening

### Change all default secrets

The two most critical defaults to change before going live:

```bash
# In .env
ADMIN_SECRET=<strong-random-value>
ELASTICSEARCH_PASSWORD=<strong-random-value>
```

Never use the defaults (`super-secret-admin-key`, `changeme`) in production.

### Restrict network access

Elasticsearch and the backend API should never be directly reachable from the internet. Verify with:

```bash
# These should time out or refuse from outside your server
curl http://your-server-ip:9200
curl http://your-server-ip:3001
```

If they respond, tighten your firewall:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001
sudo ufw deny 9200
sudo ufw enable
```

### Disable GraphQL introspection in production

In `backend/src/index.ts`, the Apollo server has `introspection: true`. For production, set this via environment variable or change it to:

```typescript
introspection: process.env.NODE_ENV !== 'production',
```

### Rotate the admin secret regularly

The `x-admin-secret` header is the only gate for admin endpoints. Rotate it periodically and update it in `.env` + any CI/CD secrets.

### Keep dependencies patched

```bash
# Check for vulnerabilities
cd backend && npm audit
cargo audit --manifest-path contracts/stellar-save/Cargo.toml

# Apply patches
npm audit fix
cargo update
```

### TLS

Always serve over HTTPS. The nginx config above enforces HTTPS redirects. Keep your Let's Encrypt certificate auto-renewing:

```bash
sudo systemctl enable certbot.timer
sudo certbot renew --dry-run
```

### Stellar private keys

- Never store deployer private keys on the server after deployment
- Use hardware wallets or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) for mainnet keys
- The `.env` file should be readable only by the service user:

```bash
sudo chown www-data:www-data /opt/stellar-save/.env
sudo chmod 600 /opt/stellar-save/.env
```

---

## Monitoring and Backups

### Monitoring stack

The repo ships a ready-to-use monitoring stack in `monitoring/` — Prometheus, Grafana, Elasticsearch, Kibana, and Filebeat — all wired together via Docker Compose.

```bash
cd monitoring

# Optional: set a Grafana admin password
export GRAFANA_PASSWORD=your-secure-password

docker compose up -d
```

| Service    | URL                     | Default credentials         |
| ---------- | ----------------------- | --------------------------- |
| Grafana    | http://your-server:3000 | admin / `$GRAFANA_PASSWORD` |
| Prometheus | http://your-server:9090 | —                           |
| Kibana     | http://your-server:5601 | —                           |

> Bind these ports to localhost or a VPN interface — don't expose them directly to the internet.

Prometheus is pre-configured to scrape the backend at `backend:3001/metrics` (see `monitoring/prometheus/prometheus.yml`). If your backend is running on the host rather than in Docker, update the target:

```yaml
# monitoring/prometheus/prometheus.yml
scrape_configs:
  - job_name: stellar-save-backend
    static_configs:
      - targets: ['host.docker.internal:3001'] # host network on Linux: use host IP
    metrics_path: /metrics
```

Then reload Prometheus:

```bash
docker compose kill -s SIGHUP prometheus
```

### Health check endpoint

```bash
curl https://your-domain.com/api/v1/health
```

Returns `200 OK` when the API is up. Wire this into your uptime monitor of choice.

### Automated backups

Set `BACKUP_ENABLED=true` in `.env` and provide AWS credentials to enable the built-in backup scheduler. It uploads snapshots to your S3 bucket and prunes old ones based on `BACKUP_RETENTION_DAYS`.

Verify backups are running:

```bash
sudo journalctl -u stellar-save-api -f | grep -i backup
```

### Log access

```bash
# API logs
sudo journalctl -u stellar-save-api -n 100 --no-pager

# nginx access logs
sudo tail -f /var/log/nginx/access.log

# Elasticsearch logs
sudo journalctl -u elasticsearch -n 50 --no-pager
```

---

## Troubleshooting

### API won't start

Check the service logs:

```bash
sudo journalctl -u stellar-save-api -n 50 --no-pager
```

Common causes:

- Missing or malformed `.env` — verify all required variables are set
- Port 3001 already in use: `sudo lsof -i :3001`
- Node.js version mismatch: `node --version` should be 20+

### Elasticsearch connection failed

The API logs will show `Elasticsearch connection failed` on startup. The app continues without search — it degrades gracefully. To fix:

```bash
# Check ES is running
sudo systemctl status elasticsearch

# Test connectivity
curl -u elastic:<password> http://localhost:9200/_cluster/health

# Check ES logs
sudo journalctl -u elasticsearch -n 50
```

If ES is running but the API can't connect, double-check `ELASTICSEARCH_NODE`, `ELASTICSEARCH_USERNAME`, and `ELASTICSEARCH_PASSWORD` in `.env`.

### Frontend shows blank page

Usually a misconfigured `VITE_*` variable at build time. Rebuild with the correct values:

```bash
# Verify the built config
grep -r "VITE_" dist/assets/*.js | head -5
```

If the contract address or network is wrong, update `.env.production` at the repo root and run `npm run build` again.

### nginx 502 Bad Gateway

The backend isn't running or isn't listening on port 3001:

```bash
sudo systemctl status stellar-save-api
curl http://localhost:3001/api/v1/health
```

### Admin API returns 401

The `x-admin-secret` header doesn't match `ADMIN_SECRET` in `.env`. Verify the value and restart the API after any `.env` change:

```bash
sudo systemctl restart stellar-save-api
```

### Contract calls failing

- Confirm `CONTRACT_STELLAR_SAVE` in `.env` matches the deployed contract ID
- Verify `STELLAR_NETWORK` and `STELLAR_RPC_URL` point to the correct network
- Check the RPC endpoint is reachable: `curl $STELLAR_RPC_URL/health`
- For mainnet, ensure the deployer account has sufficient XLM for fees

### Backup failures

Check the webhook URL is reachable and the S3 bucket exists with the correct permissions. The IAM policy for the backup user needs at minimum:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"],
  "Resource": ["arn:aws:s3:::stellar-save-backups", "arn:aws:s3:::stellar-save-backups/*"]
}
```

---

## Verifying Your Deployment

Run these checks after every fresh deployment or upgrade to confirm everything is working end-to-end.

### 1. Pre-deployment gate

Before deploying the smart contract, run the pre-deployment check script. It validates Clippy, runs a security audit, checks the WASM binary size, scans for leaked secrets, and runs the full contract test suite:

```bash
./scripts/pre_deploy_check.sh
```

All checks must pass (exit 0) before proceeding. If any fail, the script prints the failing check and exits non-zero — fix the issue and re-run.

### 2. Post-deployment smoke tests

After the contract is deployed and the backend + frontend are live, run the smoke test suite against the real network:

```bash
export CONTRACT_ID=<your-deployed-contract-id>
export STELLAR_NETWORK=testnet          # or mainnet
export STELLAR_RPC_URL=https://soroban-testnet.stellar.org

./scripts/smoke_test_post_deploy.sh
```

The script checks:
- RPC endpoint is reachable
- Contract exists on-chain
- Read-only calls return expected responses
- On testnet: creates a group and reads it back (write-path validation)

On mainnet the write-path tests are skipped automatically (read-only smoke test only).

Expected output on success:

```
════════════════════════════════════════
  Smoke tests: 4 passed, 0 failed
════════════════════════════════════════
✅ All smoke tests passed.
```

### 3. API health check

```bash
curl -s https://your-domain.com/api/v1/health | jq .
```

Should return `200 OK`.

### 4. Frontend sanity check

Open `https://your-domain.com` in a browser and confirm:
- The landing page loads without console errors
- Connecting a Freighter wallet succeeds
- The correct network (testnet/mainnet) is shown in the network indicator

---

## Updating Your Instance

```bash
cd /opt/stellar-save
git pull origin main

# Rebuild backend dependencies
cd backend && npm install --omit=dev && cd ..

# Rebuild frontend
npm install && npm run build

# Restart API
sudo systemctl restart stellar-save-api
sudo systemctl reload nginx
```

If the contract has changed, follow the upgrade path in [upgrade-guide.md](./upgrade-guide.md) before restarting.

---

## Support

- Issues: [github.com/Xoulomon/Stellar-Save/issues](https://github.com/Xoulomon/Stellar-Save/issues)
- Stellar developer docs: [developers.stellar.org](https://developers.stellar.org)
- Stellar Discord: [discord.gg/stellar](https://discord.gg/stellar)
