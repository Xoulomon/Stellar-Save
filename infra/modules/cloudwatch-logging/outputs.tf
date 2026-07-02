output "app_log_group_name" {
  description = "Name of the application log group"
  value       = aws_cloudwatch_log_group.app_logs.name
}

output "app_log_group_arn" {
  description = "ARN of the application log group"
  value       = aws_cloudwatch_log_group.app_logs.arn
}

output "audit_log_group_name" {
  description = "Name of the audit log group"
  value       = aws_cloudwatch_log_group.audit_logs.name
}

output "audit_log_group_arn" {
  description = "ARN of the audit log group"
  value       = aws_cloudwatch_log_group.audit_logs.arn
}

output "error_metric_filter_name" {
  description = "Name of the ERROR metric filter"
  value       = aws_cloudwatch_log_group_metric_filter.app_errors.name
}

output "warning_metric_filter_name" {
  description = "Name of the WARN metric filter"
  value       = aws_cloudwatch_log_group_metric_filter.app_warnings.name
}

output "critical_error_metric_filter_name" {
  description = "Name of the CRITICAL/FATAL error metric filter"
  value       = aws_cloudwatch_log_group_metric_filter.critical_errors.name
}

output "audit_event_metric_filter_name" {
  description = "Name of the audit event metric filter"
  value       = aws_cloudwatch_log_group_metric_filter.audit_events.name
}

output "log_configuration_for_ecs" {
  description = "Log configuration block for ECS task definitions"
  value = {
    logDriver = "awslogs"
    options = {
      "awslogs-group"         = aws_cloudwatch_log_group.app_logs.name
      "awslogs-region"        = data.aws_region.current.name
      "awslogs-stream-prefix" = "ecs"
    }
  }
}

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.arn
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = aws_iam_role.ecs_task_execution_role.name
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_task_role_name" {
  description = "Name of the ECS task role"
  value       = aws_iam_role.ecs_task_role.name
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role (if created)"
  value       = try(aws_iam_role.lambda_execution_role[0].arn, null)
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role (if created)"
  value       = try(aws_iam_role.lambda_execution_role[0].name, null)
}
