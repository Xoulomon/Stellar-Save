# Multi-Region Routing Module

Provisions Route53 health checks and routing records that send users to the
nearest **healthy** AWS region, and that automatically fail over when a region
goes down.

## What it creates

| Resource | Purpose |
|----------|---------|
| `aws_route53_health_check` (per region) | Probes each region's endpoint over HTTPS at `health_check_path`. |
| `aws_route53_record` latency records | Returns the lowest-latency region whose health check is healthy. |
| `aws_route53_record` geolocation records | Returns the region serving the client's location (alternative to latency). |
| `aws_route53_record` failover records | Optional explicit `PRIMARY`/`SECONDARY` record set. |

Route53 health checks and records are **global** resources, so the module only
uses the caller's default AWS provider regardless of how many regions you route
across.

## How failover works

Every routing record is bound to a health check. When a region's endpoint stops
passing its health check, Route53 removes that region from the candidate answers
and clients resolve to the next-best healthy region. No human action is required;
failover happens at DNS TTL granularity (default `60s`).

## Usage

```hcl
module "multi_region" {
  source = "../../modules/multi-region"

  environment    = "production"
  hosted_zone_id = "ZXXXXXXXXXXXXX"
  record_name    = "api.stellar-save.app"
  routing_policy = "latency" # or "geolocation"

  regions = {
    "us-east-1-primary" = {
      aws_region          = "us-east-1"
      endpoint_domain     = "alb-primary.elb.amazonaws.com"
      geolocation_default = true
    }
    "eu-west-1-secondary" = {
      aws_region            = "eu-west-1"
      endpoint_domain       = "alb-secondary.elb.amazonaws.com"
      geolocation_continent = "EU"
    }
  }

  enable_dns_failover    = true
  failover_primary_key   = "us-east-1-primary"
  failover_secondary_key = "eu-west-1-secondary"
}
```

## Notes

- `routing_policy = "geolocation"` requires each region to set
  `geolocation_continent`/`geolocation_country`, and exactly one region to set
  `geolocation_default = true` (catch-all).
- Records are `CNAME`s pointing at each region's `endpoint_domain`. To use
  Route53 alias records to an ALB/CloudFront, extend the module with the target
  zone id.

See [`docs/multi-region-failover.md`](../../../docs/multi-region-failover.md) for
the full architecture and the failover test runbook.
