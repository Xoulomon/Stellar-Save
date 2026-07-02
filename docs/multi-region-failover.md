# Multi-Region Failover & Geo-Routing

This document describes how Stellar-Save runs across multiple AWS regions, how
users are routed to the nearest healthy region, how a regional failure triggers
automatic failover, and how to **test** failover regularly.

It implements [Infrastructure] issue #1138.

## Goals

- **Latency routing** — users resolve to the AWS region closest to them.
- **Automatic failover** — if a region's endpoint becomes unhealthy, traffic
  shifts to a healthy region without human action.
- **Data resilience** — the database is replicated to a secondary region with a
  read-only replica that can be promoted during a regional outage.

## Architecture

```
                         ┌──────────────────────────┐
                         │        Route53            │
                         │  latency / geo routing    │
                         │  + per-region health checks│
                         └─────────────┬─────────────┘
              healthy & nearest        │       healthy & nearest
        ┌────────────────────────┐     │     ┌────────────────────────┐
        ▼                        │     │     │                        ▼
┌───────────────────┐           │     │     │           ┌───────────────────┐
│ PRIMARY region     │           │     │     │           │ SECONDARY region   │
│ (e.g. us-east-1)   │           │     │     │           │ (e.g. eu-west-1)   │
│                    │           │     │     │           │                    │
│ ALB → ECS backend  │           │     │     │           │ ALB → ECS backend  │
│ CloudFront + S3    │           │     │     │           │ CloudFront + S3    │
│ RDS PRIMARY ───────┼── async cross-region replication ─┼──► RDS READ REPLICA│
└───────────────────┘                                    └───────────────────┘
```

### Components

| Layer | Mechanism | Terraform |
|-------|-----------|-----------|
| DNS routing | Route53 latency or geolocation records, each bound to a health check | `infra/modules/multi-region` |
| Health checks | Route53 HTTPS health checks against each region's `/health` | `infra/modules/multi-region` |
| Compute | ECS/Fargate behind an ALB, per region | `infra/modules/ecs` |
| Edge/static | CloudFront + S3, per region | `infra/modules/frontend` |
| Database (primary) | Encrypted Multi-AZ PostgreSQL RDS | `infra/modules/rds` |
| Database (replica) | Cross-region read-only RDS replica | `infra/modules/rds-read-replica` |

All multi-region behavior is **additive and gated by variables that default to
single-region**, so existing `terraform plan`/`apply` for staging and production
are unaffected until you opt in.

## Enabling multi-region

Multi-region is enabled in the production environment via variables. See
[`infra/environments/production.multi-region.tfvars.example`](../infra/environments/production.multi-region.tfvars.example).

```bash
cd infra/envs/production
terraform plan  -var-file=../../environments/production.multi-region.tfvars
terraform apply -var-file=../../environments/production.multi-region.tfvars
```

Key toggles:

| Variable | Default | Effect |
|----------|---------|--------|
| `enable_multi_region` | `false` | Creates Route53 health checks + routing records. |
| `routing_policy` | `latency` | `latency` (nearest) or `geolocation` (by client location). |
| `secondary_aws_region` | `us-east-1` | Region for failover and the read replica. |
| `enable_cross_region_replica` | `false` | Creates a cross-region read-only RDS replica. |

The secondary region uses the `aws.secondary` provider alias declared in
`infra/envs/production/provider.tf`.

## How routing works

1. A client resolves `api.stellar-save.app`.
2. Route53 evaluates the **latency** (or **geolocation**) records and the
   per-region **health check** state.
3. It answers with the lowest-latency region **whose health check is currently
   healthy**.
4. The TTL (default `60s`) bounds how long a stale answer can be cached.

An optional explicit `PRIMARY`/`SECONDARY` failover record set
(`failover.api.stellar-save.app`) is also created for clients/tooling that want
strict active-passive behavior rather than latency routing.

## How failover works

### Automatic (region failure)

Each region endpoint is monitored by a Route53 health check
(`HTTPS GET /health`, 30s interval, 3 consecutive failures to mark unhealthy).
When a region's endpoint fails:

1. The health check transitions to **unhealthy** (~90s by default:
   3 × 30s interval).
2. Route53 stops returning that region's record.
3. New DNS resolutions return only healthy region(s); clients reconnect there
   within the record TTL.

No human action is required. End-to-end shift is roughly
`(failure_threshold × request_interval) + record_ttl` ≈ 90s + 60s.

### Database failover (regional outage of the primary)

The cross-region replica is **read-only** until promoted. To recover writes in
the secondary region:

1. Promote the replica to a standalone primary:
   ```bash
   aws rds promote-read-replica \
     --db-instance-identifier stellar-save-production-replica \
     --region <secondary_aws_region>
   ```
2. Point the secondary region's backend at the promoted instance (update its DB
   secret/host) and confirm it accepts writes.
3. Once the original primary region recovers, rebuild it as a new replica of the
   promoted primary (or fail back during a maintenance window).

> Promotion is irreversible — the promoted instance no longer replicates from
> the old primary. Treat fail-back as a planned operation.

### Manual failover / draining a region

To deliberately move traffic off a region (maintenance, partial outage):

- **Fastest:** disable/invalidate the region's health check so Route53 marks it
  unhealthy and drains it:
  ```bash
  aws route53 update-health-check \
    --health-check-id <id> --disabled
  ```
  Re-enable with `--no-disabled` to restore the region.
- **Alternative:** scale the region's ECS service to 0 (or block the ALB health
  path) so the health check fails naturally.

Get health check IDs from Terraform outputs:
```bash
cd infra/envs/production
terraform output multi_region_health_check_ids
```

## Failover test runbook (run regularly)

Test failover at least quarterly, and after any change to routing, health
checks, or the replica. This complements the weekly DR checks in
[`disaster-recovery.md`](disaster-recovery.md) and
`.github/workflows/disaster-recovery.yml`.

### 1. Baseline

```bash
cd infra/envs/production
terraform output multi_region_routing_record         # e.g. api.stellar-save.app
terraform output multi_region_health_check_ids

# Confirm both regions are healthy
for id in $(terraform output -json multi_region_health_check_ids | jq -r '.[]'); do
  aws route53 get-health-check-status --health-check-id "$id" \
    --query 'HealthCheckObservations[].StatusReport.Status'
done

# Confirm current resolution
dig +short api.stellar-save.app
curl -fsS https://api.stellar-save.app/health
```

### 2. Induce a primary-region failure

```bash
PRIMARY_HC=<primary health check id>
aws route53 update-health-check --health-check-id "$PRIMARY_HC" --disabled
```

### 3. Verify traffic shifts to the healthy region

```bash
# Within ~(90s health + 60s TTL), resolution should move to the secondary region
watch -n 10 'dig +short api.stellar-save.app; curl -fsS https://api.stellar-save.app/health'
```

Expected: `/health` keeps returning `200` throughout; resolved endpoint changes
from the primary to the secondary region's domain.

### 4. (Optional) Verify database promotion path

In a non-production drill, promote the replica per the steps above and confirm
the secondary backend can serve writes. Do **not** promote the production
replica during a routine test unless performing a real fail-over.

### 5. Restore

```bash
aws route53 update-health-check --health-check-id "$PRIMARY_HC" --no-disabled
# After ~90s confirm the primary is healthy and latency routing returns to it
dig +short api.stellar-save.app
```

### Test checklist

- [ ] Both health checks report healthy at baseline.
- [ ] Disabling the primary health check shifts resolution to the secondary.
- [ ] `/health` returns `200` for the entire transition (no user-visible outage).
- [ ] Re-enabling the health check returns traffic to the primary.
- [ ] (Drill) Replica promotion succeeds and the secondary backend accepts writes.
- [ ] Record the measured failover time in the test log.

## Related documents

- [Disaster Recovery](disaster-recovery.md) — failure scenarios, RTO/RPO, weekly CI checks
- [Incident Response Plan](incident-response-plan.md) — severity levels and comms
- [Deployment Guide](deployment.md) — deploy and rollback
- [Multi-Environment Deployment](multi-environment-deployment.md)
- Module: [`infra/modules/multi-region`](../infra/modules/multi-region/README.md)
- Module: [`infra/modules/rds-read-replica`](../infra/modules/rds-read-replica)
