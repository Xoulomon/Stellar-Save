output "sns_topic_arn" {
  description = "ARN of the SNS topic used for budget alert notifications"
  value       = aws_sns_topic.budget_alerts.arn
}

output "environment_budget_name" {
  description = "Name of the overall environment AWS Budget"
  value       = aws_budgets_budget.environment.name
}

output "per_service_budget_names" {
  description = "Names of the per-service AWS Budgets"
  value       = { for k, v in aws_budgets_budget.per_service : k => v.name }
}

output "billing_alarm_name" {
  description = "CloudWatch alarm that fires when estimated daily charges approach the budget"
  value       = aws_cloudwatch_metric_alarm.estimated_charges.alarm_name
}
