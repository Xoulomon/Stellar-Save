# Infrastructure as Code (IaC)

Stellar-Save infrastructure is defined with **Terraform** for reproducible, version-controlled deployments.

## Structure

```
infra/
├── bootstrap/          # One-time: creates S3 state bucket + DynamoDB lock table
├── modules/
│   └── frontend/       # Reusable S3 + CloudFront module
└── envs/
    ├── staging/        # staging.stellar-save.app  (Stellar testnet)
    └── production/     # stellar-save.app          (Stellar mainnet)
```

## Resources managed

Each environment provisions:
- **S3 bucket** — static frontend hosting (private, versioned, encrypted)
- **CloudFront distribution** — CDN with HTTPS, SPA routing (index.html fallback), OAC-only S3 access

## State management

Remote state is stored in S3 with DynamoDB locking to prevent concurrent applies:

| Resource | Name |
|----------|------|
| S3 bucket | `stellar-save-terraform-state` |
| DynamoDB table | `stellar-save-terraform-locks` |
| State key (staging) | `staging/terraform.tfstate` |
| State key (production) | `production/terraform.tfstate` |

## First-time setup

**1. Bootstrap the state backend** (run once, uses local state):

```bash
cd infra/bootstrap
terraform init
terraform apply
```

**2. Deploy staging:**

```bash
cd infra/envs/staging
terraform init
terraform apply -var="acm_certificate_arn=arn:aws:acm:us-east-1:..."
```

**3. Deploy production** (requires `acm_certificate_arn`):

```bash
cd infra/envs/production
terraform init
terraform apply -var="acm_certificate_arn=arn:aws:acm:us-east-1:..."
```

## CI/CD

The `.github/workflows/infra.yml` workflow:

| Trigger | Action |
|---------|--------|
| Pull request touching `infra/` | `validate` + `plan` (plan posted as PR comment) |
| Push to `main` | `validate` → `apply staging` → `apply production` (production requires manual approval) |

## Required secrets / variables

| Name | Type | Description |
|------|------|-------------|
| `AWS_ACCESS_KEY_ID` | Secret | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Secret | AWS credentials |
| `STAGING_ACM_CERT_ARN` | Variable | ACM cert for `staging.stellar-save.app` |
| `PROD_ACM_CERT_ARN` | Secret | ACM cert for `stellar-save.app` |

## Running tests locally

```bash
bash tests/infra_test.sh
```

Tests run `terraform fmt`, `terraform validate`, and structural checks on all environments and the shared module. Terraform must be installed (`>= 1.7`). No AWS credentials needed for validate-only tests.

## Deploying frontend after infra apply

After `terraform apply`, get the outputs and use them in the blue-green deploy workflow:

```bash
terraform -chdir=infra/envs/staging output -raw frontend_bucket_name
terraform -chdir=infra/envs/staging output -raw cloudfront_distribution_id
```
