# infra/modules/multi-region/main.tf
# Reusable module: multi-region traffic routing for Stellar-Save.
#
# Provisions Route53 health checks per region endpoint and routing records that
# send users to the nearest HEALTHY region (latency-based routing) or to the
# region serving their geographic location (geolocation routing). Because every
# routing record is associated with a health check, Route53 automatically stops
# returning a region whose endpoint becomes unhealthy — i.e. a region failure
# triggers automatic failover to the next best healthy region.
#
# Route53 health checks and records are global resources, so this module only
# needs the default (caller-provided) AWS provider regardless of how many
# regions are being routed across.

locals {
  name_prefix = "stellar-save-${var.environment}"

  failover_record_name = var.failover_record_name != "" ? var.failover_record_name : "failover.${var.record_name}"

  latency_regions     = var.routing_policy == "latency" ? var.regions : {}
  geolocation_regions = var.routing_policy == "geolocation" ? var.regions : {}
}

# ── Per-region health checks ──────────────────────────────────────────────────
resource "aws_route53_health_check" "this" {
  for_each = var.regions

  fqdn              = each.value.endpoint_domain
  port              = each.value.health_check_port
  type              = each.value.health_check_type
  resource_path     = each.value.health_check_path
  request_interval  = each.value.request_interval
  failure_threshold = each.value.failure_threshold
  measure_latency   = each.value.measure_latency

  tags = merge(var.tags, {
    Environment = var.environment
    Name        = "${local.name_prefix}-${each.key}"
    Region      = each.value.aws_region
  })
}

# ── Latency-based routing records (nearest healthy region) ────────────────────
# Route53 returns the lowest-latency region whose health check is healthy. If a
# region fails, it is dropped from the candidate set automatically.
resource "aws_route53_record" "latency" {
  for_each = local.latency_regions

  zone_id        = var.hosted_zone_id
  name           = var.record_name
  type           = "CNAME"
  ttl            = var.record_ttl
  set_identifier = each.key
  records        = [each.value.endpoint_domain]

  latency_routing_policy {
    region = each.value.aws_region
  }

  health_check_id = aws_route53_health_check.this[each.key].id
}

# ── Geolocation routing records (region by client location) ───────────────────
resource "aws_route53_record" "geolocation" {
  for_each = local.geolocation_regions

  zone_id        = var.hosted_zone_id
  name           = var.record_name
  type           = "CNAME"
  ttl            = var.record_ttl
  set_identifier = each.key
  records        = [each.value.endpoint_domain]

  geolocation_routing_policy {
    continent = each.value.geolocation_default ? null : each.value.geolocation_continent
    country   = each.value.geolocation_default ? "*" : each.value.geolocation_country
  }

  health_check_id = aws_route53_health_check.this[each.key].id
}

# ── Explicit PRIMARY/SECONDARY DNS failover record set (optional) ─────────────
resource "aws_route53_record" "failover_primary" {
  count = var.enable_dns_failover ? 1 : 0

  zone_id        = var.hosted_zone_id
  name           = local.failover_record_name
  type           = "CNAME"
  ttl            = var.record_ttl
  set_identifier = "primary"
  records        = [var.regions[var.failover_primary_key].endpoint_domain]

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.this[var.failover_primary_key].id
}

resource "aws_route53_record" "failover_secondary" {
  count = var.enable_dns_failover ? 1 : 0

  zone_id        = var.hosted_zone_id
  name           = local.failover_record_name
  type           = "CNAME"
  ttl            = var.record_ttl
  set_identifier = "secondary"
  records        = [var.regions[var.failover_secondary_key].endpoint_domain]

  failover_routing_policy {
    type = "SECONDARY"
  }

  health_check_id = aws_route53_health_check.this[var.failover_secondary_key].id
}
