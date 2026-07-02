# Resource Tagging Standard

All AWS resources provisioned by Terraform must carry the six cost-allocation tags below. This lets Cost Explorer filter and group spend by environment and service, and is enforced in CI on every pull request that touches `infra/`.

## Required tags

| Tag key | Example values | Set by |
|---------|---------------|--------|
| `Project` | `stellar-save` | Provider `default_tags` |
| `Environment` | `staging` \| `production` | Provider `default_tags` |
| `ManagedBy` | `terraform` | Provider `default_tags` |
| `CostCenter` | `engineering` | Provider `default_tags` |
| `Owner` | `platform-team` | Provider `default_tags` |
| `Service` | `ecs` \| `rds` \| `frontend` \| `codedeploy` \| `budget-alerts` \| `cost-dashboard` \| `cloudwatch-logging` | Module `tags` argument |

`Project`, `Environment`, `ManagedBy`, `CostCenter`, and `Owner` are injected automatically by the AWS provider's `default_tags` block in each environment's `provider.tf`. You only need to set `Service` explicitly when calling a module.

## How to tag a new module call

Pass `Service` as part of the `tags` argument merged with the env's `local.common_tags`:

```hcl
# infra/envs/production/main.tf
locals {
  common_tags = {
    Project     = "stellar-save"
    Environment = "production"
    ManagedBy   = "terraform"
    CostCenter  = "engineering"
    Owner       = "platform-team"
  }
}

module "my_new_service" {
  source = "../../modules/my-new-service"
  ...
  tags = merge(local.common_tags, { Service = "my-new-service" })
}
```

Each reusable module must accept a `tags` variable and apply it via `merge(var.tags, { Environment = var.environment })` so the environment-level tag is never missing.

## How to write a new reusable module

Every module must declare:

```hcl
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
```

And pass to every resource:

```hcl
resource "aws_some_resource" "example" {
  ...
  tags = merge(var.tags, { Name = "my-resource-${var.environment}" })
}
```

Do **not** hard-code `Project`, `Environment`, `ManagedBy`, `CostCenter`, or `Owner` inside modules — those come from the caller.

## Enforcement

### CI (pull requests)

The `tag-compliance` job in `.github/workflows/cost-monitoring.yml` runs automatically on any PR that modifies `infra/`. It:

1. Runs `terraform plan` for staging and production (without real credentials if secrets are absent).
2. Converts the plan to JSON.
3. Runs `scripts/check-tags.sh` against both plans.
4. Fails the PR if any resource is missing a required tag.

### Local

```bash
# Check a specific environment without applying
bash scripts/check-tags.sh infra/envs/staging
bash scripts/check-tags.sh infra/envs/production

# Or point at a pre-generated plan JSON
terraform -chdir=infra/envs/staging plan -out=plan.tfplan
terraform -chdir=infra/envs/staging show -json plan.tfplan > plan.json
PLAN_JSON=plan.json bash scripts/check-tags.sh
```

## Cost Explorer

Once tags are propagated (up to 24 hours after `terraform apply`), navigate to [AWS Cost Explorer](https://console.aws.amazon.com/cost-management/home#/custom) and group by:

- **Tag: Environment** — compare staging vs. production total spend
- **Tag: Service** — compare ECS / RDS / CloudFront / CodeDeploy costs
- **Tag: Project** — isolate stellar-save costs from any shared account resources

## Budget alerts

Each environment has an AWS Budget managed by `infra/modules/budget-alerts`:

| Environment | Default monthly limit | Notification thresholds |
|-------------|----------------------|------------------------|
| staging | $100 | 50%, 80%, 100% actual + 80%, 100% forecasted |
| production | $500 | 50%, 80%, 100% actual + 80%, 100% forecasted |

Per-service budgets cover ECS (40% of limit), RDS (30%), and CloudFront/frontend (15%).

Override the defaults via tfvars:

```hcl
# infra/envs/production/terraform.tfvars
monthly_budget_usd    = 750
budget_alert_emails   = ["platform@example.com", "finance@example.com"]
```

## Cost dashboard

A CloudWatch dashboard named `stellar-save-costs-<environment>` is provisioned by `infra/modules/cost-dashboard`. It shows:

- Live `AWS/Billing` EstimatedCharges gauge vs. the budget
- Per-service billing gauges (ECS, RDS)
- ECS CPU/memory utilization trends (Fargate cost drivers)
- RDS CPU, free storage, and IOPS (storage/IOPS cost drivers)
- CloudFront requests and data transfer (egress cost driver)

Open it in the AWS Console: **CloudWatch → Dashboards → stellar-save-costs-production**.
