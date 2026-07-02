# infra/modules/budget-alerts/main.tf
# AWS Budgets with escalating threshold notifications via SNS/email.

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name_prefix = "stellar-save-${var.environment}"
}

# ── SNS topic for budget notifications ────────────────────────────────────────
resource "aws_sns_topic" "budget_alerts" {
  name = "${local.name_prefix}-budget-alerts"
  tags = merge(var.tags, { Service = "budget-alerts" })
}

resource "aws_sns_topic_subscription" "email" {
  for_each = toset(var.alert_email_addresses)

  topic_arn = aws_sns_topic.budget_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# Allow AWS Budgets service to publish to the SNS topic
resource "aws_sns_topic_policy" "budget_alerts" {
  arn = aws_sns_topic.budget_alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBudgetsPublish"
        Effect = "Allow"
        Principal = {
          Service = "budgets.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.budget_alerts.arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# ── Overall environment budget ────────────────────────────────────────────────
resource "aws_budgets_budget" "environment" {
  name         = "${local.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  dynamic "notification" {
    for_each = var.alert_thresholds_pct
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
    }
  }

  # Forecasted cost alerts at 80% and 100% so teams can react before overage
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}

# ── Per-service budgets (fractional of total) ─────────────────────────────────
locals {
  service_budgets = {
    ecs      = { limit = ceil(var.monthly_budget_usd * 0.40), service_filter = "Amazon Elastic Container Service" }
    rds      = { limit = ceil(var.monthly_budget_usd * 0.30), service_filter = "Amazon Relational Database Service" }
    frontend = { limit = ceil(var.monthly_budget_usd * 0.15), service_filter = "Amazon CloudFront" }
  }
}

resource "aws_budgets_budget" "per_service" {
  for_each = local.service_budgets

  name         = "${local.name_prefix}-${each.key}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(each.value.limit)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = [each.value.service_filter]
  }

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$${var.environment}"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}

# ── CloudWatch alarm: billing anomaly (us-east-1 global metric) ───────────────
# EstimatedCharges is only emitted in us-east-1. Configure your provider region
# as us-east-1 (the project default) for this alarm to function.
resource "aws_cloudwatch_metric_alarm" "estimated_charges" {
  alarm_name          = "${local.name_prefix}-estimated-charges"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 86400  # daily
  statistic           = "Maximum"
  threshold           = var.monthly_budget_usd * 0.8
  alarm_description   = "Daily estimated charges exceeded 80% of ${var.environment} monthly budget"
  treat_missing_data  = "notBreaching"

  dimensions = {
    Currency = "USD"
  }

  alarm_actions = [aws_sns_topic.budget_alerts.arn]
  ok_actions    = [aws_sns_topic.budget_alerts.arn]

  tags = merge(var.tags, { Service = "budget-alerts" })
}
