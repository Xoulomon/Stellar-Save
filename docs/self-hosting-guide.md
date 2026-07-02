# Self-Hosting Guide for the Full Stack

This guide helps a third party stand up a complete Stellar-Save deployment from infrastructure through the frontend and backend.

## 1. Prerequisites

Before you begin, prepare the following:

- a Kubernetes or container-hosting environment for the backend and frontend
- a PostgreSQL-compatible database
- a Redis instance for caching and analytics middleware
- access to a Stellar RPC endpoint for testnet or mainnet
- a wallet or key pair for contract deployment
- storage for persistent artifacts such as backups or uploads

## 2. Infrastructure prerequisites

Recommended baseline:

- 1 application backend instance
- 1 frontend deployment
- 1 Redis instance
- 1 PostgreSQL primary with optional read replica
- 1 worker or cron job for the contract event indexer

Terraform flow:

1. Review the infrastructure definitions in the repo under the infra directory.
2. Set the required environment variables for the target environment.
3. Run the Terraform init/apply flow for the target environment.
4. Capture the generated outputs for the database endpoint, Redis endpoint, and service URLs.

Example flow:

```bash
cd infra
terraform init
terraform plan -var-file=environments/<env>.tfvars
terraform apply -var-file=environments/<env>.tfvars
```

## 3. Contract deployment and configuration

1. Build and deploy the Soroban contract using the deployment scripts and network settings in the repo.
2. Record the deployed contract ID and network details.
3. Configure the backend and frontend to use the deployed contract address.
4. Ensure the contract deployment account has enough funds for the network.

Required contract-related configuration:

- `CONTRACT_ID`
- `STELLAR_NETWORK`
- `STELLAR_RPC_URL`
- contract deployment secret or key material

## 4. Backend and frontend deployment

### Backend

The backend needs the following environment variables:

- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `STELLAR_RPC_URL`
- `CONTRACT_ID`
- `NOTIFICATION_*` secrets if email or push delivery is enabled

Deploy the backend service and verify that it can connect to the database and Redis.

### Frontend

The frontend should receive the backend API URL and contract configuration via environment variables:

- `VITE_API_URL`
- `VITE_CONTRACT_ID`
- `VITE_STELLAR_NETWORK`

## 5. Smoke-test checklist

After the first deployment, verify the core flows in a fresh environment:

- [ ] The frontend loads successfully.
- [ ] The backend health endpoint responds.
- [ ] The contract can be read from the configured network.
- [ ] A user can create or join a group.
- [ ] A contribution can be submitted successfully.
- [ ] A payout flow completes without a contract error.
- [ ] Notifications and emails are emitted where enabled.
- [ ] Cache and indexer metrics are visible and healthy.

## 6. Operational notes

- Keep deployment secrets in a secure secret store rather than in source control.
- Rotate keys and secret material on a regular basis.
- Monitor contract event lag, cache hit rate, and database health after each deployment.
- Use the staging or testnet environment first, then promote to production.
