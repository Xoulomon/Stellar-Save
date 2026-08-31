output "codedeploy_app_name" {
  description = "Name of the CodeDeploy application"
  value       = aws_codedeploy_app.ecs_app.name
}

output "codedeploy_app_arn" {
  description = "ARN of the CodeDeploy application"
  value       = aws_codedeploy_app.ecs_app.arn
}

output "deployment_group_name" {
  description = "Name of the CodeDeploy deployment group"
  value       = aws_codedeploy_deployment_group.ecs_deployment_group.deployment_group_name
}

output "codedeploy_role_arn" {
  description = "ARN of the CodeDeploy service role"
  value       = aws_iam_role.codedeploy_role.arn
}

output "codedeploy_role_name" {
  description = "Name of the CodeDeploy service role"
  value       = aws_iam_role.codedeploy_role.name
}

output "error_rate_alarm_name" {
  description = "CloudWatch alarm name for 5xx error rate"
  value       = aws_cloudwatch_alarm.high_error_rate.alarm_name
}

output "error_rate_alarm_arn" {
  description = "CloudWatch alarm ARN for 5xx error rate"
  value       = aws_cloudwatch_alarm.high_error_rate.arn
}

output "blue_green_deployment_info" {
  description = "Summary of blue-green deployment configuration"
  value = {
    canary_traffic_percentage   = var.canary_traffic_percentage
    canary_duration_minutes     = var.canary_duration_minutes
    blue_termination_wait_minutes = var.blue_termination_wait_minutes
    error_threshold             = var.error_rate_threshold
    auto_rollback_enabled       = true
  }
}
