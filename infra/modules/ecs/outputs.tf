output "cluster_id" {
  description = "ECS cluster ID"
  value       = aws_ecs_cluster.backend.id
}

output "cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.backend.name
}

output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.backend.name
}

output "task_definition_arn" {
  description = "ARN of the latest task definition"
  value       = aws_ecs_task_definition.backend.arn
}

output "target_group_arn" {
  description = "ALB target group ARN — attach to an ALB listener rule"
  value       = aws_lb_target_group.backend.arn
}

output "log_group_name" {
  description = "CloudWatch log group name for the backend containers"
  value       = aws_cloudwatch_log_group.backend.name
}

output "task_execution_role_arn" {
  description = "IAM role ARN used by ECS to pull images and write logs"
  value       = aws_iam_role.task_execution.arn
}
