# CloudWatch Log Aggregation Module

This Terraform module implements centralized log aggregation for AWS ECS tasks and Lambda functions using CloudWatch Logs, with structured log patterns and automated metric filters.

## Overview

The module provides:
- **Dedicated Log Groups**: Separate log groups for application logs (30-day retention) and audit logs (90-day retention)
- **Metric Filters**: Automated pattern matching for ERROR, WARN, and CRITICAL log levels
- **IAM Roles & Policies**: Pre-configured execution roles with CloudWatch Logs permissions
- **CloudWatch Alarms**: Optional alarm creation for critical error monitoring
- **Structured Logging**: Support for both ECS tasks and Lambda functions

## Features

### Log Groups with Retention

| Log Group | Retention | Purpose |
|-----------|-----------|---------|
| `/aws/stellar-save/{env}/app` | 30 days | Application logs from services |
| `/aws/stellar-save/{env}/audit` | 90 days | Audit trail and compliance logs |

### Metric Filters

| Filter | Pattern | Namespace | Metric |
|--------|---------|-----------|--------|
| ERROR | `[ERROR] || [error] || Exception || exception` | `StellarSave/{env}` | `ApplicationErrorCount` |
| WARN | `[WARN] || [warn] || warning` | `StellarSave/{env}` | `ApplicationWarningCount` |
| CRITICAL | `[CRITICAL] || [FATAL] || [fatal]` | `StellarSave/{env}` | `ApplicationCriticalErrorCount` |
| AUDIT | Structured events | `StellarSave/{env}` | `AuditEventCount` |

### IAM Roles

**ECS Task Execution Role**
- Permissions to create and write to CloudWatch Log Groups
- Required for task startup and logging

**ECS Task Role**
- Application-level permissions (attach additional policies as needed)

**Lambda Execution Role** (optional)
- Basic Lambda execution permissions
- CloudWatch Logs write permissions

## Usage

### Basic Configuration (Staging)

```hcl
module "cloudwatch_logging" {
  source                     = "../../modules/cloudwatch-logging"
  environment                = "staging"
  app_log_retention_days     = 30
  audit_log_retention_days   = 90
  create_alarms              = true
  create_lambda_role         = false
  tags = {
    Project   = "stellar-save"
    ManagedBy = "terraform"
  }
}
```

### ECS Task Definition Integration

Reference the log configuration in your ECS task definition:

```hcl
resource "aws_ecs_task_definition" "api_server" {
  family                   = "api-server"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = module.cloudwatch_logging.ecs_task_execution_role_arn
  task_role_arn            = module.cloudwatch_logging.ecs_task_role_arn

  container_definitions = jsonencode([{
    name              = "api-server"
    image             = "stellar-save:latest"
    essential         = true
    logConfiguration  = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = module.cloudwatch_logging.app_log_group_name
        "awslogs-region"        = "us-east-1"
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}
```

### Lambda Function Integration

```hcl
resource "aws_lambda_function" "my_function" {
  filename         = "lambda.zip"
  function_name    = "my-function"
  role            = module.cloudwatch_logging.lambda_execution_role_arn
  handler         = "index.handler"
  
  environment {
    variables = {
      LOG_GROUP = module.cloudwatch_logging.app_log_group_name
    }
  }
}
```

## Inputs

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `environment` | string | - | Environment name (staging/production) |
| `app_log_retention_days` | number | 30 | Retention period for application logs |
| `audit_log_retention_days` | number | 90 | Retention period for audit logs |
| `ecs_task_execution_role_id` | string | - | IAM role ID for ECS task execution |
| `lambda_execution_role_id` | string | null | IAM role ID for Lambda execution |
| `create_alarms` | bool | true | Create CloudWatch alarms |
| `critical_error_alarm_threshold` | number | 1 | Critical error alarm threshold |
| `create_lambda_role` | bool | false | Create Lambda execution role |
| `tags` | map(string) | `{}` | Tags for all resources |

## Outputs

| Name | Description |
|------|-------------|
| `app_log_group_name` | Name of application log group |
| `app_log_group_arn` | ARN of application log group |
| `audit_log_group_name` | Name of audit log group |
| `audit_log_group_arn` | ARN of audit log group |
| `ecs_task_execution_role_arn` | ARN of ECS task execution role |
| `ecs_task_role_arn` | ARN of ECS task application role |
| `lambda_execution_role_arn` | ARN of Lambda execution role |
| `log_configuration_for_ecs` | Pre-formatted log config for ECS |

## Logging Best Practices

### Application Code

Log messages should include relevant context:

```typescript
// Good: Structured logging with context
logger.info('User login', { userId: '123', timestamp: new Date().toISOString() });
logger.error('Database connection failed', { error: err.message, retryCount: 3 });
logger.warn('High memory usage', { memoryMB: 512 });
```

### Log Patterns

Use consistent log levels in your application:

```
[ERROR] - Critical failure, requires attention
[WARN]  - Warning, non-blocking issue
[INFO]  - Informational message
[DEBUG] - Detailed debugging information
```

### Structured Audit Logging

Audit logs should include required fields:

```
timestamp,request_id,action,user_id,resource,result
2026-05-31T10:30:00Z,req-123,LOGIN,user-456,auth-service,success
2026-05-31T10:31:00Z,req-124,DELETE,user-456,contract-789,success
```

## Monitoring

### View Logs

```bash
# View recent logs
aws logs tail /aws/stellar-save/production/app --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/stellar-save/production/app \
  --filter-pattern "[ERROR]"
```

### CloudWatch Metrics

Metrics are automatically published to the `StellarSave/{environment}` namespace:

```bash
# Query error metrics
aws cloudwatch get-metric-statistics \
  --namespace "StellarSave/production" \
  --metric-name "ApplicationErrorCount" \
  --start-time 2026-05-31T00:00:00Z \
  --end-time 2026-05-31T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Alarms

Critical error alarms are created when the module is enabled. Configure SNS topics for notifications:

```hcl
resource "aws_sns_topic" "alerts" {
  name = "stellar-save-alerts"
}

# Subscribe to alerts
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "ops@stellar-save.app"
}
```

## Cost Considerations

- **Log Storage**: ~$0.50/GB ingested, ~$0.03/GB stored (varies by region)
- **Metric Filters**: No charge for creating filters
- **Alarms**: $0.10/alarm/month
- **Queries**: $0.005 per 1MB scanned with CloudWatch Insights

**Retention Tip**: Adjust retention periods in `terraform.tfvars` to balance compliance needs with costs.

## Troubleshooting

### Logs not appearing

1. Check IAM role permissions
2. Verify log group exists: `aws logs describe-log-groups --log-group-name-prefix /aws/stellar-save`
3. Check task/function execution role has CloudWatch Logs permissions
4. Verify awslogs driver configuration in task/function definition

### High log volume

- Increase retention period to reduce costs
- Filter logs at source (application code)
- Use log groups per service to organize better

### Metric filters not matching

- Check filter pattern syntax: [AWS documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)
- Test patterns with CloudWatch Logs Insights
- Verify log format matches expected pattern

## References

- [AWS CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Log Filter Pattern Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)
- [ECS Task Definition awslogs Driver](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_cloudwatch_logs.html)
- [Lambda CloudWatch Logs Integration](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-functions-logs.html)
