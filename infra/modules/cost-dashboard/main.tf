# infra/modules/cost-dashboard/main.tf
# CloudWatch dashboard showing cost-correlated resource utilization by service
# and environment, plus live AWS Billing EstimatedCharges widgets.

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

locals {
  dashboard_name  = "stellar-save-costs-${var.environment}"
  budget_80pct    = var.monthly_budget_usd * 0.8
  budget_50pct    = var.monthly_budget_usd * 0.5
}

resource "aws_cloudwatch_dashboard" "costs" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      # ── Row 1: Billing overview ─────────────────────────────────────────────
      {
        type   = "text"
        x      = 0; y = 0; width = 24; height = 1
        properties = {
          markdown = "## Stellar-Save Cost Dashboard — ${upper(var.environment)}  |  Budget: $${var.monthly_budget_usd}/month  |  Region: ${var.aws_region}"
        }
      },

      # Estimated charges gauge (us-east-1 global billing metric)
      {
        type   = "metric"
        x      = 0; y = 1; width = 8; height = 6
        properties = {
          title  = "Estimated Monthly Charges (USD)"
          view   = "gauge"
          region = "us-east-1"  # Billing metrics are only in us-east-1
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "Currency", "USD",
             { stat = "Maximum", period = 86400, label = "Total" }]
          ]
          yAxis = { left = { min = 0, max = var.monthly_budget_usd } }
          annotations = {
            horizontal = [
              { value = local.budget_50pct, label = "50% budget", color = "#f89256" },
              { value = local.budget_80pct, label = "80% budget", color = "#d13212" }
            ]
          }
        }
      },

      # ECS estimated charges
      {
        type   = "metric"
        x      = 8; y = 1; width = 8; height = 6
        properties = {
          title  = "ECS Estimated Charges (USD)"
          view   = "gauge"
          region = "us-east-1"
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "ServiceName", "Amazon Elastic Container Service", "Currency", "USD",
             { stat = "Maximum", period = 86400 }]
          ]
          yAxis = { left = { min = 0, max = floor(var.monthly_budget_usd * 0.4) } }
        }
      },

      # RDS estimated charges
      {
        type   = "metric"
        x      = 16; y = 1; width = 8; height = 6
        properties = {
          title  = "RDS Estimated Charges (USD)"
          view   = "gauge"
          region = "us-east-1"
          metrics = [
            ["AWS/Billing", "EstimatedCharges", "ServiceName", "Amazon Relational Database Service", "Currency", "USD",
             { stat = "Maximum", period = 86400 }]
          ]
          yAxis = { left = { min = 0, max = floor(var.monthly_budget_usd * 0.3) } }
        }
      },

      # ── Row 2: ECS utilization (CPU & memory drive Fargate cost) ───────────
      {
        type   = "text"
        x      = 0; y = 7; width = 24; height = 1
        properties = { markdown = "### ECS (Fargate) — CPU & Memory Utilization" }
      },

      {
        type   = "metric"
        x      = 0; y = 8; width = 12; height = 6
        properties = {
          title   = "ECS CPU Utilization %"
          view    = "timeSeries"
          region  = var.aws_region
          metrics = [
            ["AWS/ECS", "CPUUtilization",
             "ClusterName", var.ecs_cluster_name,
             "ServiceName", var.ecs_service_name,
             { stat = "Average", period = 300, label = "Avg CPU %" }],
            ["...", { stat = "Maximum", period = 300, label = "Max CPU %" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
          annotations = {
            horizontal = [{ value = 70, label = "Scale-out threshold", color = "#f89256" }]
          }
        }
      },

      {
        type   = "metric"
        x      = 12; y = 8; width = 12; height = 6
        properties = {
          title   = "ECS Memory Utilization %"
          view    = "timeSeries"
          region  = var.aws_region
          metrics = [
            ["AWS/ECS", "MemoryUtilization",
             "ClusterName", var.ecs_cluster_name,
             "ServiceName", var.ecs_service_name,
             { stat = "Average", period = 300, label = "Avg Mem %" }],
            ["...", { stat = "Maximum", period = 300, label = "Max Mem %" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },

      # ── Row 3: RDS utilization ──────────────────────────────────────────────
      {
        type   = "text"
        x      = 0; y = 14; width = 24; height = 1
        properties = { markdown = "### RDS (PostgreSQL) — Cost-Driving Metrics" }
      },

      {
        type   = "metric"
        x      = 0; y = 15; width = 8; height = 6
        properties = {
          title   = "RDS CPU Utilization %"
          view    = "timeSeries"
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "CPUUtilization",
             "DBInstanceIdentifier", var.rds_instance_identifier,
             { stat = "Average", period = 300 }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },

      {
        type   = "metric"
        x      = 8; y = 15; width = 8; height = 6
        properties = {
          title   = "RDS Storage Used (GB)"
          view    = "timeSeries"
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "FreeStorageSpace",
             "DBInstanceIdentifier", var.rds_instance_identifier,
             { stat = "Minimum", period = 300, label = "Free (bytes)" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 16; y = 15; width = 8; height = 6
        properties = {
          title   = "RDS I/O Operations (IOPS cost driver)"
          view    = "timeSeries"
          region  = var.aws_region
          metrics = [
            ["AWS/RDS", "ReadIOPS",
             "DBInstanceIdentifier", var.rds_instance_identifier,
             { stat = "Sum", period = 300, label = "Read IOPS" }],
            ["AWS/RDS", "WriteIOPS",
             "DBInstanceIdentifier", var.rds_instance_identifier,
             { stat = "Sum", period = 300, label = "Write IOPS" }]
          ]
        }
      },

      # ── Row 4: CloudFront / S3 (frontend cost) ──────────────────────────────
      {
        type   = "text"
        x      = 0; y = 21; width = 24; height = 1
        properties = { markdown = "### CloudFront / S3 — Data Transfer & Request Costs" }
      },

      {
        type   = "metric"
        x      = 0; y = 22; width = 12; height = 6
        properties = {
          title   = "CloudFront Requests"
          view    = "timeSeries"
          region  = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "Requests",
             "DistributionId", var.cloudfront_distribution_id,
             "Region", "Global",
             { stat = "Sum", period = 3600, label = "Requests/hr" }]
          ]
        }
      },

      {
        type   = "metric"
        x      = 12; y = 22; width = 12; height = 6
        properties = {
          title   = "CloudFront Data Transfer Out (GB — cost driver)"
          view    = "timeSeries"
          region  = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "BytesDownloaded",
             "DistributionId", var.cloudfront_distribution_id,
             "Region", "Global",
             { stat = "Sum", period = 3600, label = "Bytes Downloaded" }]
          ]
        }
      },

      # ── Row 5: Cost Explorer deep-link ──────────────────────────────────────
      {
        type   = "text"
        x      = 0; y = 28; width = 24; height = 3
        properties = {
          markdown = join("\n", [
            "### Cost Explorer Tag-Based Breakdown",
            "",
            "Filter by `Environment = ${var.environment}` in [AWS Cost Explorer](https://console.aws.amazon.com/cost-management/home#/custom) to see spend broken down by the `Service` tag.",
            "",
            "**Required tags on all resources:** `Project` · `Environment` · `Service` · `ManagedBy` · `CostCenter` · `Owner`",
            "",
            "Run `scripts/check-tags.sh` locally or in CI to verify tag compliance before a plan is applied."
          ])
        }
      }
    ]
  })
}
