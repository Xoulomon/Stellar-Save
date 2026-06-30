# infra/envs/production/outputs.tf

output "frontend_bucket_name" {
  value = module.frontend.bucket_name
}

output "cloudfront_distribution_id" {
  value = module.frontend.cloudfront_distribution_id
}

output "cloudfront_domain_name" {
  value = module.frontend.cloudfront_domain_name
}

# CodeDeploy Outputs
output "codedeploy_app_name" {
  description = "Name of the CodeDeploy application"
  value       = module.codedeploy.codedeploy_app_name
}

output "codedeploy_app_arn" {
  description = "ARN of the CodeDeploy application"
  value       = module.codedeploy.codedeploy_app_arn
}

output "deployment_group_name" {
  description = "Name of the CodeDeploy deployment group"
  value       = module.codedeploy.deployment_group_name
}

output "codedeploy_role_arn" {
  description = "ARN of the CodeDeploy service role"
  value       = module.codedeploy.codedeploy_role_arn
}

output "error_rate_alarm_name" {
  description = "CloudWatch alarm for 5xx error rate"
  value       = module.codedeploy.error_rate_alarm_name
}

output "blue_green_deployment_config" {
  description = "Blue-green deployment configuration summary"
  value       = module.codedeploy.blue_green_deployment_info
}

# ── Budget alerts ─────────────────────────────────────────────────────────────
output "budget_sns_topic_arn" {
  description = "SNS topic ARN for budget alert notifications"
  value       = module.budget_alerts.sns_topic_arn
}

output "environment_budget_name" {
  description = "Name of the overall production AWS Budget"
  value       = module.budget_alerts.environment_budget_name
}

output "per_service_budget_names" {
  description = "Per-service AWS Budget names"
  value       = module.budget_alerts.per_service_budget_names
}

output "billing_alarm_name" {
  description = "CloudWatch alarm that fires when daily estimated charges near the budget"
  value       = module.budget_alerts.billing_alarm_name
}

# ── Cost dashboard ────────────────────────────────────────────────────────────
output "cost_dashboard_name" {
  description = "CloudWatch cost dashboard name"
  value       = module.cost_dashboard.dashboard_name
}

output "cost_dashboard_arn" {
  description = "CloudWatch cost dashboard ARN"
  value       = module.cost_dashboard.dashboard_arn
# ── Multi-region routing outputs ──────────────────────────────────────────────
output "multi_region_enabled" {
  description = "Whether multi-region routing is enabled"
  value       = var.enable_multi_region
}

output "multi_region_routing_record" {
  description = "FQDN clients use to reach the nearest/healthiest region"
  value       = var.enable_multi_region ? module.multi_region[0].routing_record_name : ""
}

output "multi_region_failover_record" {
  description = "Explicit PRIMARY/SECONDARY failover record name"
  value       = var.enable_multi_region ? module.multi_region[0].failover_record_name : ""
}

output "multi_region_health_check_ids" {
  description = "Route53 health check IDs per region"
  value       = var.enable_multi_region ? module.multi_region[0].health_check_ids : {}
}

# ── Cross-region read replica outputs ─────────────────────────────────────────
output "rds_read_replica_endpoint" {
  description = "Cross-region read replica endpoint (empty when disabled)"
  value       = module.rds_read_replica.replica_endpoint
}

output "rds_read_replica_arn" {
  description = "Cross-region read replica ARN (empty when disabled)"
  value       = module.rds_read_replica.replica_arn
}
