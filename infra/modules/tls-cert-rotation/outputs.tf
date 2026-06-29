output "certificate_arn" {
  description = "ARN of the validated ACM certificate"
  value       = aws_acm_certificate_validation.this.certificate_arn
}

output "certificate_domain" {
  description = "Primary domain of the certificate"
  value       = aws_acm_certificate.this.domain_name
}

output "cert_expiry_lambda_arn" {
  description = "ARN of the daily cert-expiry monitor Lambda"
  value       = aws_lambda_function.cert_expiry_monitor.arn
}

output "alarm_30d_arn" {
  description = "ARN of the 30-day expiry CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.cert_expiry_30d.arn
}

output "alarm_7d_arn" {
  description = "ARN of the 7-day (critical) expiry CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.cert_expiry_7d.arn
}
