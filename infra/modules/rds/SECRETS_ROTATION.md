# AWS Secrets Manager Database Credential Rotation

This module implements automatic rotation of PostgreSQL RDS credentials using AWS Secrets Manager.

## Overview

The rotation system provides:
- **Automatic 30-day rotation schedule** (configurable via `rotation_days` variable)
- **Zero-downtime rotation** using AWS single-user rotation strategy
- **Lambda-based rotation function** using AWS-provided PostgreSQL template
- **ECS integration** for runtime credential fetching

## Architecture

```
┌─────────────────┐
│  ECS Task       │
│  (Backend)      │
│                 │
│  Fetches creds  │
│  at startup     │
└────────┬────────┘
         │
         │ GetSecretValue
         ▼
┌─────────────────────────┐
│  Secrets Manager        │
│  /stellar-save-{env}/   │
│  db-credentials         │
│                         │
│  Rotation Schedule:     │
│  Every 30 days          │
└────────┬────────────────┘
         │
         │ Invokes on rotation
         ▼
┌─────────────────────────┐
│  Lambda Function        │
│  rotation-lambda        │
│                         │
│  Steps:                 │
│  1. createSecret        │
│  2. setSecret           │
│  3. testSecret          │
│  4. finishSecret        │
└────────┬────────────────┘
         │
         │ ALTER USER password
         ▼
┌─────────────────────────┐
│  RDS PostgreSQL         │
│  stellar-save-{env}     │
└─────────────────────────┘
```

## Rotation Process

The rotation follows AWS's four-step process:

### 1. createSecret
- Generates a new random 32-character password
- Stores it in Secrets Manager with `AWSPENDING` label
- Does not modify the database yet

### 2. setSecret
- Connects to RDS using current (`AWSCURRENT`) credentials
- Executes `ALTER USER` to update the password to the new value
- Database now accepts both old and new passwords

### 3. testSecret
- Attempts connection using the new (`AWSPENDING`) credentials
- Validates with a simple `SELECT 1` query
- Fails rotation if connection unsuccessful

### 4. finishSecret
- Moves `AWSCURRENT` label to the new secret version
- Old version becomes `AWSPREVIOUS` (retained for rollback)
- Rotation complete

## Components

### Terraform Resources

#### `aws_secretsmanager_secret`
- Stores database credentials as JSON
- Format: `{username, password, host, port, dbname, engine, dbInstanceIdentifier}`

#### `aws_secretsmanager_secret_rotation`
- Configures automatic rotation schedule
- Default: 30 days (configurable)

#### `aws_lambda_function`
- Python 3.11 runtime
- Executes rotation logic
- Runs in VPC to access RDS

#### IAM Roles & Policies
- **Lambda Execution Role**: VPC access, CloudWatch logs
- **Secrets Manager Permissions**: Read/write secret, generate password
- **RDS Permissions**: Describe and modify DB instance

#### Security Groups
- Lambda security group with egress to RDS
- RDS ingress rule allowing Lambda connections

### Lambda Function

**Location**: `infra/modules/rds/rotation_lambda/index.py`

**Dependencies**:
- `psycopg2-binary`: PostgreSQL driver
- `boto3`: AWS SDK

**Environment Variables**:
- `SECRETS_MANAGER_ENDPOINT`: Regional endpoint URL

### ECS Integration

The ECS task definition fetches credentials at container startup:

```json
{
  "secrets": [
    {"name": "DB_USERNAME", "valueFrom": "arn:...:username::"},
    {"name": "DB_PASSWORD", "valueFrom": "arn:...:password::"},
    {"name": "DB_HOST", "valueFrom": "arn:...:host::"},
    {"name": "DB_PORT", "valueFrom": "arn:...:port::"},
    {"name": "DB_NAME", "valueFrom": "arn:...:dbname::"}
  ]
}
```

**Backend Configuration** (`backend/src/config.ts`):
- Constructs `DATABASE_URL` from individual environment variables
- Falls back to `DATABASE_URL` env var for local development
- Prisma client uses the constructed URL

## Deployment

### Prerequisites

1. **Python 3.11** and **pip** installed locally
2. **VPC with private subnets** for Lambda and RDS
3. **Security groups** configured for backend ECS tasks

### Build Lambda Package

```bash
cd infra/modules/rds
chmod +x build_rotation_lambda.sh
./build_rotation_lambda.sh
```

This creates `rotation_lambda.zip` with all dependencies.

### Terraform Apply

```bash
cd infra/envs/staging
terraform init
terraform plan
terraform apply
```

### Verify Rotation

1. **Check rotation configuration**:
   ```bash
   aws secretsmanager describe-secret \
     --secret-id stellar-save-staging/db-credentials
   ```

2. **Trigger manual rotation** (optional):
   ```bash
   aws secretsmanager rotate-secret \
     --secret-id stellar-save-staging/db-credentials
   ```

3. **Monitor Lambda logs**:
   ```bash
   aws logs tail /aws/lambda/stellar-save-staging-rotation --follow
   ```

## Configuration Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `rotation_days` | Days between automatic rotations | `30` |
| `aws_region` | AWS region for Secrets Manager | `us-east-1` |

## Security Considerations

### Password Complexity
- 32 characters long
- Excludes problematic characters: `/@"'\`
- Generated using AWS Secrets Manager's cryptographically secure generator

### Network Security
- Lambda runs in private subnets (no internet access required)
- RDS only accessible from Lambda and ECS security groups
- Secrets Manager uses VPC endpoints (optional, recommended for production)

### IAM Least Privilege
- Lambda role limited to specific secret ARN
- ECS execution role can only read (not write) secrets
- No wildcard permissions

### Audit & Monitoring
- CloudWatch logs for all rotation attempts
- Secrets Manager version history retained
- Failed rotations trigger CloudWatch alarms (recommended)

## Troubleshooting

### Rotation Fails at setSecret
**Symptom**: Lambda logs show "permission denied" or "authentication failed"

**Solution**:
- Verify Lambda security group can reach RDS
- Check RDS security group allows Lambda ingress on port 5432
- Confirm current credentials in secret match RDS master user

### ECS Tasks Fail to Start
**Symptom**: Tasks stop immediately with "CannotPullSecretError"

**Solution**:
- Verify ECS execution role has `secretsmanager:GetSecretValue` permission
- Check secret ARN is correct in task definition
- Ensure secret exists and has `AWSCURRENT` version

### Database Connection Errors After Rotation
**Symptom**: Backend logs show "password authentication failed"

**Solution**:
- ECS tasks cache credentials at startup - restart tasks to fetch new credentials
- Check Secrets Manager shows successful rotation (AWSCURRENT label updated)
- Verify Lambda testSecret step passed

## Testing

### Unit Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
# Test with local DATABASE_URL
export DATABASE_URL="postgresql://user:pass@localhost:5432/test"
npm test

# Test with individual components (simulates ECS)
export DB_USERNAME="user"
export DB_PASSWORD="pass"
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="test"
npm test
```

### Manual Rotation Test
```bash
# Trigger rotation
aws secretsmanager rotate-secret \
  --secret-id stellar-save-staging/db-credentials

# Watch logs
aws logs tail /aws/lambda/stellar-save-staging-rotation --follow

# Verify new credentials work
aws secretsmanager get-secret-value \
  --secret-id stellar-save-staging/db-credentials \
  --version-stage AWSCURRENT | jq -r .SecretString
```

## Rollback

If rotation causes issues:

```bash
# Get previous version ID
aws secretsmanager describe-secret \
  --secret-id stellar-save-staging/db-credentials

# Move AWSCURRENT back to previous version
aws secretsmanager update-secret-version-stage \
  --secret-id stellar-save-staging/db-credentials \
  --version-stage AWSCURRENT \
  --move-to-version-id <previous-version-id> \
  --remove-from-version-id <current-version-id>

# Restart ECS tasks to fetch old credentials
aws ecs update-service \
  --cluster stellar-save-backend-staging \
  --service stellar-save-backend-staging \
  --force-new-deployment
```

## Production Considerations

1. **Multi-AZ RDS**: Enable for high availability
2. **VPC Endpoints**: Use Secrets Manager VPC endpoint to avoid NAT gateway costs
3. **CloudWatch Alarms**: Alert on rotation failures
4. **Rotation Window**: Schedule during low-traffic periods
5. **Connection Pooling**: Configure Prisma connection pool to handle credential changes gracefully
6. **Blue-Green Deployment**: Coordinate ECS deployments with rotation schedule

## References

- [AWS Secrets Manager Rotation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [PostgreSQL Rotation Strategy](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets-rds.html)
- [ECS Secrets Integration](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data-secrets.html)
