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
