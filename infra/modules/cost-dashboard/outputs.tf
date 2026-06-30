output "dashboard_name" {
  description = "Name of the CloudWatch cost dashboard"
  value       = aws_cloudwatch_dashboard.costs.dashboard_name
}

output "dashboard_arn" {
  description = "ARN of the CloudWatch cost dashboard"
  value       = aws_cloudwatch_dashboard.costs.dashboard_arn
}
