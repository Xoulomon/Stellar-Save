# CloudWatch Log Groups and Log Shipping Configuration
# Provides centralized logging infrastructure for ECS tasks and Lambda functions

# ── Data source for current AWS region ─────────────────────────────────────────
data "aws_region" "current" {}

# ── Application Log Group ─────────────────────────────────────────────────────
# Standard 30-day retention for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/stellar-save/${var.environment}/app"
  retention_in_days = var.app_log_retention_days

  tags = merge(
    var.tags,
    {
      Name        = "stellar-save-app-logs-${var.environment}"
      LogType     = "application"
      Environment = var.environment
    }
  )
}

# ── Audit Log Group ───────────────────────────────────────────────────────────
# Extended 90-day retention for audit and compliance logs
resource "aws_cloudwatch_log_group" "audit_logs" {
  name              = "/aws/stellar-save/${var.environment}/audit"
  retention_in_days = var.audit_log_retention_days

  tags = merge(
    var.tags,
    {
      Name        = "stellar-save-audit-logs-${var.environment}"
      LogType     = "audit"
      Environment = var.environment
    }
  )
}

# ── ERROR Log Pattern Metric Filter ───────────────────────────────────────────
# Detects ERROR patterns in application logs
resource "aws_cloudwatch_log_group_metric_filter" "app_errors" {
  name           = "ErrorCount"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  filter_pattern = "[ERROR] || [error] || Exception || exception"

  metric_transformation {
    name      = "ApplicationErrorCount"
    namespace = "StellarSave/${var.environment}"
    value     = "1"
    unit      = "Count"

    default_value = 0
  }

  depends_on = [aws_cloudwatch_log_group.app_logs]
}

# ── WARN Log Pattern Metric Filter ────────────────────────────────────────────
# Detects WARN patterns in application logs
resource "aws_cloudwatch_log_group_metric_filter" "app_warnings" {
  name           = "WarnCount"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  filter_pattern = "[WARN] || [warn] || warning"

  metric_transformation {
    name      = "ApplicationWarningCount"
    namespace = "StellarSave/${var.environment}"
    value     = "1"
    unit      = "Count"

    default_value = 0
  }

  depends_on = [aws_cloudwatch_log_group.app_logs]
}

# ── CRITICAL ERROR Metric Filter (for alarms) ─────────────────────────────────
# Detects CRITICAL or FATAL errors for immediate alerting
resource "aws_cloudwatch_log_group_metric_filter" "critical_errors" {
  name           = "CriticalErrorCount"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  filter_pattern = "[CRITICAL] || [FATAL] || [fatal]"

  metric_transformation {
    name      = "ApplicationCriticalErrorCount"
    namespace = "StellarSave/${var.environment}"
    value     = "1"
    unit      = "Count"

    default_value = 0
  }

  depends_on = [aws_cloudwatch_log_group.app_logs]
}

# ── Audit Trail Metric Filter ────────────────────────────────────────────────
# Tracks audit events for security and compliance
resource "aws_cloudwatch_log_group_metric_filter" "audit_events" {
  name           = "AuditEventCount"
  log_group_name = aws_cloudwatch_log_group.audit_logs.name
  filter_pattern = "[timestamp, request_id, action, user_id, resource, result]"

  metric_transformation {
    name      = "AuditEventCount"
    namespace = "StellarSave/${var.environment}"
    value     = "1"
    unit      = "Count"

    default_value = 0
  }

  depends_on = [aws_cloudwatch_log_group.audit_logs]
}

# ── IAM Policy for ECS Task Execution Role ────────────────────────────────────
# Allows ECS tasks to write logs to CloudWatch
resource "aws_iam_role_policy" "ecs_cloudwatch_logs_policy" {
  name   = "stellar-save-ecs-cloudwatch-logs-${var.environment}"
  role   = var.ecs_task_execution_role_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.app_logs.arn}:*",
          "${aws_cloudwatch_log_group.audit_logs.arn}:*"
        ]
      }
    ]
  })
}

# ── IAM Policy for Lambda Execution Role ──────────────────────────────────────
# Allows Lambda functions to write logs to CloudWatch
resource "aws_iam_role_policy" "lambda_cloudwatch_logs_policy" {
  count  = var.lambda_execution_role_id != null ? 1 : 0
  name   = "stellar-save-lambda-cloudwatch-logs-${var.environment}"
  role   = var.lambda_execution_role_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.app_logs.arn}:*",
          "${aws_cloudwatch_log_group.audit_logs.arn}:*"
        ]
      }
    ]
  })
}

# ── Optional: Create Alarms for Critical Errors ───────────────────────────────
# Alarm triggers when critical errors exceed threshold
resource "aws_cloudwatch_metric_alarm" "critical_errors_alarm" {
  count               = var.create_alarms ? 1 : 0
  alarm_name          = "stellar-save-critical-errors-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApplicationCriticalErrorCount"
  namespace           = "StellarSave/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = var.critical_error_alarm_threshold
  alarm_description   = "Alert when critical errors occur in ${var.environment}"
  treat_missing_data  = "notBreaching"

  depends_on = [aws_cloudwatch_log_group_metric_filter.critical_errors]

  tags = merge(
    var.tags,
    {
      Name = "stellar-save-critical-errors-alarm-${var.environment}"
    }
  )
}
