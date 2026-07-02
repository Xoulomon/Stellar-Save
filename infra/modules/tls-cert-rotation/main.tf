# infra/modules/tls-cert-rotation/main.tf
#
# Automated SSL/TLS certificate lifecycle management (Issue #1168).
#
# Resources:
#   - ACM certificate with DNS (Route 53) validation — auto-renewed by AWS
#   - Route 53 validation CNAME records
#   - Lambda function that publishes daily cert-expiry metrics to CloudWatch
#   - CloudWatch alarms at 30-day and 7-day expiry thresholds
#   - SNS notifications to the supplied ops-alerts topic

locals {
  name_prefix = "stellar-save-tls-${var.environment}"
}

# ── ACM Certificate ────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = "tls-cert-rotation"
  })
}

# ── Route 53 DNS validation records ───────────────────────────────────────────

resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

# ── IAM role for the cert-expiry Lambda ───────────────────────────────────────

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cert_expiry_lambda" {
  name               = "${local.name_prefix}-cert-expiry-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "cert_expiry_lambda_policy" {
  statement {
    sid = "ACMListAndDescribe"
    actions = [
      "acm:ListCertificates",
      "acm:DescribeCertificate",
    ]
    resources = ["*"]
  }
  statement {
    sid       = "CloudWatchPutMetric"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
  }
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:*:*:*"]
  }
}

resource "aws_iam_role_policy" "cert_expiry_lambda" {
  name   = "${local.name_prefix}-cert-expiry-policy"
  role   = aws_iam_role.cert_expiry_lambda.id
  policy = data.aws_iam_policy_document.cert_expiry_lambda_policy.json
}

# ── Lambda: daily cert-expiry metric publisher ─────────────────────────────────
#
# Inline Python code — no external build step required.

resource "aws_lambda_function" "cert_expiry_monitor" {
  function_name = "${local.name_prefix}-cert-expiry-monitor"
  role          = aws_iam_role.cert_expiry_lambda.arn
  runtime       = "python3.12"
  handler       = "index.handler"
  timeout       = 60

  filename         = data.archive_file.cert_expiry_lambda.output_path
  source_code_hash = data.archive_file.cert_expiry_lambda.output_base64sha256

  environment {
    variables = {
      CW_NAMESPACE = "StellarSave/TLS"
      DOMAIN_FILTER = var.domain_name
    }
  }

  tags = var.tags
}

data "archive_file" "cert_expiry_lambda" {
  type        = "zip"
  output_path = "${path.module}/cert_expiry_lambda.zip"

  source {
    filename = "index.py"
    content  = <<-PYTHON
import boto3, datetime, os

def handler(event, context):
    acm = boto3.client('acm')
    cw  = boto3.client('cloudwatch')
    ns  = os.environ.get('CW_NAMESPACE', 'StellarSave/TLS')
    domain_filter = os.environ.get('DOMAIN_FILTER', '')

    paginator = acm.get_paginator('list_certificates')
    now = datetime.datetime.now(datetime.timezone.utc)

    for page in paginator.paginate(CertificateStatuses=['ISSUED']):
        for cert_summary in page['CertificateSummaryList']:
            arn    = cert_summary['CertificateArn']
            detail = acm.describe_certificate(CertificateArn=arn)['Certificate']
            domain = detail['DomainName']

            if domain_filter and domain_filter not in domain:
                continue

            expiry    = detail['NotAfter']
            days_left = (expiry - now).days

            cw.put_metric_data(
                Namespace=ns,
                MetricData=[{
                    'MetricName': 'CertificateDaysUntilExpiry',
                    'Dimensions': [{'Name': 'Domain', 'Value': domain}],
                    'Value': float(days_left),
                    'Unit': 'Count',
                }]
            )
            print(f"{domain}: {days_left} days until expiry")
PYTHON
  }
}

# ── EventBridge schedule: run Lambda daily at 06:00 UTC ──────────────────────

resource "aws_cloudwatch_event_rule" "daily_cert_check" {
  name                = "${local.name_prefix}-daily-cert-check"
  schedule_expression = "cron(0 6 * * ? *)"
  tags                = var.tags
}

resource "aws_cloudwatch_event_target" "cert_expiry_lambda" {
  rule = aws_cloudwatch_event_rule.daily_cert_check.name
  arn  = aws_lambda_function.cert_expiry_monitor.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cert_expiry_monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_cert_check.arn
}

# ── CloudWatch Alarms ─────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cert_expiry_30d" {
  alarm_name          = "${local.name_prefix}-cert-expiry-30d"
  alarm_description   = "TLS certificate for ${var.domain_name} expires in ≤ 30 days"
  namespace           = "StellarSave/TLS"
  metric_name         = "CertificateDaysUntilExpiry"
  dimensions          = { Domain = var.domain_name }
  statistic           = "Minimum"
  period              = 86400 # 24 h
  evaluation_periods  = 1
  threshold           = 30
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [var.alarm_sns_topic_arn]
  ok_actions          = [var.alarm_sns_topic_arn]

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cert_expiry_7d" {
  alarm_name          = "${local.name_prefix}-cert-expiry-7d-CRITICAL"
  alarm_description   = "CRITICAL: TLS certificate for ${var.domain_name} expires in ≤ 7 days"
  namespace           = "StellarSave/TLS"
  metric_name         = "CertificateDaysUntilExpiry"
  dimensions          = { Domain = var.domain_name }
  statistic           = "Minimum"
  period              = 86400
  evaluation_periods  = 1
  threshold           = 7
  comparison_operator = "LessThanOrEqualToThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [var.alarm_sns_topic_arn]
  ok_actions          = [var.alarm_sns_topic_arn]

  tags = var.tags
}
