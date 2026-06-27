# CloudWatch Logs Insights saved queries for correlation ID tracing
# Deployed via Terraform alongside the cloudwatch-logging module.

# ── Trace a single request end-to-end by correlation ID ─────────────────────
resource "aws_cloudwatch_query_definition" "trace_by_correlation_id" {
  name = "stellar-save/${var.environment}/trace-by-correlation-id"

  log_group_names = [
    "/aws/stellar-save/${var.environment}/app",
    "/aws/stellar-save/${var.environment}/audit",
  ]

  query_string = <<-EOQ
    fields @timestamp, service, level, message, correlationId, path, method, status_code, duration_ms, walletAddress
    | filter correlationId = "<PASTE_CORRELATION_ID_HERE>"
    | sort @timestamp asc
  EOQ
}

# ── High-error-rate detection across services ────────────────────────────────
resource "aws_cloudwatch_query_definition" "error_rate_by_service" {
  name = "stellar-save/${var.environment}/error-rate-by-service"

  log_group_names = [
    "/aws/stellar-save/${var.environment}/app",
  ]

  query_string = <<-EOQ
    fields @timestamp, service, level, message, correlationId
    | filter level in ["error", "warn"]
    | stats count() as errorCount by service, level, bin(5m)
    | sort errorCount desc
  EOQ
}

# ── Slow requests (P95 latency) ──────────────────────────────────────────────
resource "aws_cloudwatch_query_definition" "slow_requests" {
  name = "stellar-save/${var.environment}/slow-requests"

  log_group_names = [
    "/aws/stellar-save/${var.environment}/app",
  ]

  query_string = <<-EOQ
    fields @timestamp, method, path, status_code, duration_ms, correlationId
    | filter ispresent(duration_ms)
    | stats pct(duration_ms, 95) as p95_ms, pct(duration_ms, 99) as p99_ms, max(duration_ms) as max_ms, count() as req_count by path
    | sort p95_ms desc
    | limit 20
  EOQ
}

# ── Indexer activity — how many transactions indexed per minute ──────────────
resource "aws_cloudwatch_query_definition" "indexer_activity" {
  name = "stellar-save/${var.environment}/indexer-activity"

  log_group_names = [
    "/aws/stellar-save/${var.environment}/app",
  ]

  query_string = <<-EOQ
    fields @timestamp, message, correlationId
    | filter service = "stellar-save-backend" and message like /\[HorizonIndexer\]/
    | stats count() as indexed_batches by bin(1m)
    | sort @timestamp desc
  EOQ
}

# ── Failed backup jobs ───────────────────────────────────────────────────────
resource "aws_cloudwatch_query_definition" "backup_failures" {
  name = "stellar-save/${var.environment}/backup-failures"

  log_group_names = [
    "/aws/stellar-save/${var.environment}/app",
  ]

  query_string = <<-EOQ
    fields @timestamp, message, correlationId
    | filter message like /BackupMonitor/ and level = "warn" or level = "error"
    | sort @timestamp desc
    | limit 50
  EOQ
}

# ── Correlation ID Dashboard ─────────────────────────────────────────────────
resource "aws_cloudwatch_dashboard" "correlation_tracing" {
  dashboard_name = "stellar-save-${var.environment}-correlation-tracing"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "log"
        x      = 0
        y      = 0
        width  = 24
        height = 6
        properties = {
          title   = "Trace Request by Correlation ID"
          view    = "table"
          region  = data.aws_region.current.name
          query   = "SOURCE '/aws/stellar-save/${var.environment}/app' | fields @timestamp, service, level, message, correlationId, path, method, status_code, duration_ms | sort @timestamp asc | limit 200"
          logGroupNames = ["/aws/stellar-save/${var.environment}/app"]
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "Error Rate by Service (5m bins)"
          view    = "bar"
          region  = data.aws_region.current.name
          query   = "SOURCE '/aws/stellar-save/${var.environment}/app' | filter level in [\"error\", \"warn\"] | stats count() as errorCount by service, bin(5m)"
          logGroupNames = ["/aws/stellar-save/${var.environment}/app"]
        }
      },
      {
        type   = "log"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title   = "P95 Latency by Path"
          view    = "bar"
          region  = data.aws_region.current.name
          query   = "SOURCE '/aws/stellar-save/${var.environment}/app' | filter ispresent(duration_ms) | stats pct(duration_ms, 95) as p95_ms by path | sort p95_ms desc | limit 10"
          logGroupNames = ["/aws/stellar-save/${var.environment}/app"]
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 4
        properties = {
          title   = "Backup Monitor Alerts"
          view    = "table"
          region  = data.aws_region.current.name
          query   = "SOURCE '/aws/stellar-save/${var.environment}/app' | filter message like /BackupMonitor/ | sort @timestamp desc | limit 20"
          logGroupNames = ["/aws/stellar-save/${var.environment}/app"]
        }
      }
    ]
  })
}
