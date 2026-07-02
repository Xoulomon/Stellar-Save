# infra/modules/multi-region/outputs.tf

output "health_check_ids" {
  description = "Map of region set-identifier => Route53 health check ID"
  value       = { for k, hc in aws_route53_health_check.this : k => hc.id }
}

output "routing_record_name" {
  description = "FQDN clients use to reach the nearest/healthiest region"
  value       = var.record_name
}

output "failover_record_name" {
  description = "FQDN of the explicit PRIMARY/SECONDARY failover record set (empty when disabled)"
  value       = var.enable_dns_failover ? local.failover_record_name : ""
}

output "routing_policy" {
  description = "Active routing policy for the main record set"
  value       = var.routing_policy
}
