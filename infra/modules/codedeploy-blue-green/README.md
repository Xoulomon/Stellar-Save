# CodeDeploy Blue-Green Deployment Module

This module implements a production-ready blue-green deployment strategy for ECS services using AWS CodeDeploy, enabling zero-downtime deployments with automatic rollback capabilities.

## Overview

The blue-green deployment strategy allows you to:
- Deploy new versions to a parallel "green" environment
- Gradually shift traffic using canary deployment (10% for 5 minutes)
- Complete cutover to green environment
- Automatically rollback on critical errors (5xx rate > 1%)
- Terminate old (blue) instances after successful deployment

## Features

### ✅ Core Capabilities

| Feature | Configuration |
|---------|---|
| **Deployment Strategy** | Blue-Green with traffic control |
| **Traffic Routing** | Time-based canary (10% for 5 minutes) |
| **Automatic Rollback** | Enabled on CloudWatch alarms and failures |
| **Rollback Trigger** | 5xx error rate threshold (default: ~1%) |
| **Blue Instance Termination** | Automatic after 5-minute stability window |
| **Deployment Type** | ECS-based with ALB integration |

### 🔄 Traffic Shifting Process

```
Time: 0 min          Time: 5 min         Time: 5+ min
Blue: 100%           Blue: 90%           Blue: 0%
Green: 0%     →      Green: 10%    →     Green: 100%
              Canary Phase         Full Cutover
              (Monitor errors)
```

### 🚨 Automatic Rollback Triggers

1. **Deployment Failure** - Automatic rollback if deployment fails
2. **Stop on Alarm** - Rollback triggered by CloudWatch alarm (5xx errors)
3. **High Error Rate** - 5xx error count exceeds threshold within 2 consecutive minutes

## Module Architecture

### Resources Created

```
aws_codedeploy_app                         # CodeDeploy application
  ↓
aws_codedeploy_deployment_group           # Blue-green deployment configuration
  ↓
aws_cloudwatch_alarm                      # 5xx error rate monitoring
  ↓
aws_iam_role (CodeDeploy)                 # Service role
  ↓
aws_iam_role_policy                       # ECS/EC2/ALB permissions
```

### IAM Permissions

CodeDeploy role includes permissions for:
- **EC2**: Full management for instance replacement
- **Auto Scaling**: Group management for green fleet
- **ALB**: Target group and load balancer operations
- **ECS**: Service updates and task set management
- **CloudWatch**: Alarm monitoring and log access

## Configuration

### Variables

| Variable | Type | Default | Description |
|----------|------|---------|---|
| `environment` | string | required | Environment name (staging/production) |
| `load_balancer_name` | string | required | ALB name for metrics |
| `target_group_name` | string | required | Target group name for metrics |
| `error_rate_threshold` | number | 10 | 5xx error count threshold for rollback |
| `canary_traffic_percentage` | number | 10 | % of traffic during canary phase |
| `canary_duration_minutes` | number | 5 | Duration of canary phase |
| `blue_termination_wait_minutes` | number | 5 | Time to wait before terminating blue instances |
| `tags` | map(string) | {} | Tags to apply to resources |

### Environment-Specific Configuration

#### Staging Configuration
```hcl
module "codedeploy" {
  source = "../../modules/codedeploy-blue-green"
  environment                = "staging"
  load_balancer_name         = "stellar-save-alb-staging"
  target_group_name          = "stellar-save-backend-staging"
  canary_traffic_percentage  = 10
  canary_duration_minutes    = 5
  error_rate_threshold       = 10
}
```

#### Production Configuration
```hcl
module "codedeploy" {
  source = "../../modules/codedeploy-blue-green"
  environment                = "production"
  load_balancer_name         = "stellar-save-alb-production"
  target_group_name          = "stellar-save-backend-production"
  canary_traffic_percentage  = 10
  canary_duration_minutes    = 5
  error_rate_threshold       = 10
}
```

## Integration with ECS

### Prerequisites

Before using this module, ensure you have:
1. **ALB (Application Load Balancer)** - For traffic routing
2. **ECS Cluster** - For running services
3. **ECS Service** - Configured for deployments
4. **Auto Scaling Group** - For managing blue/green instances
5. **CloudWatch Monitoring** - For ALB metrics

### ECS Service Configuration for Blue-Green

```hcl
resource "aws_ecs_service" "backend" {
  name            = "stellar-save-backend-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "EC2"  # or FARGATE

  # Load balancer configuration
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "stellar-save-api"
    container_port   = 3000
  }

  # Deployment configuration compatible with CodeDeploy
  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  # Enable circuit breaker for managed rollback
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [
    aws_lb_listener.backend,
    aws_iam_role_policy.ecs_task_execution_role_policy
  ]
}
```

### IAM Role for ECS Tasks

```hcl
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "stellar-save-ecs-task-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}
```

## Deployment Process

### Using AWS Console

1. Navigate to **CodeDeploy** → **Applications**
2. Select `stellar-save-{environment}`
3. Click **Create deployment**
4. Configure:
   - **Revision location**: S3 bucket with deployment package
   - **Content options**: Leave defaults
5. Click **Create deployment**
6. Monitor the deployment process in real-time

### Using AWS CLI

```bash
# Create a deployment
aws deploy create-deployment \
  --application-name stellar-save-staging \
  --deployment-group-name stellar-save-backend-staging \
  --s3-location s3://my-bucket/deployment.zip \
  --deployment-config-name CodeDeployDefault.AllAtOnce \
  --description "Deploy new backend version"

# Get deployment status
aws deploy get-deployment \
  --deployment-id d-XXXXX

# Stop deployment
aws deploy stop-deployment \
  --deployment-id d-XXXXX
```

### Using Terraform

```hcl
resource "aws_codedeploy_deployment" "backend" {
  app_name               = module.codedeploy.codedeploy_app_name
  deployment_group_name  = module.codedeploy.deployment_group_name
  deployment_config_name = "CodeDeployDefault.AllAtOnce"

  s3_location {
    bucket = aws_s3_bucket.deployments.id
    key    = "backend/latest.zip"
    bundle_type = "zip"
  }
}
```

## Monitoring & Troubleshooting

### CloudWatch Metrics

Monitor deployments using these key metrics:

```bash
# View deployment status
aws deploy list-deployments \
  --application-name stellar-save-staging \
  --query 'deployments' \
  --output table

# Get detailed deployment info
aws deploy batch-get-deployments \
  --deployment-ids d-XXXXX

# Monitor 5xx errors
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/stellar-save-alb-staging/xxxxx \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum
```

### Log Files

CodeDeploy logs are written to instance system logs:

```bash
# On EC2 instance (blue/green)
sudo tail -f /var/log/codedeploy-agent/deployments/logs/scripts.log
sudo tail -f /var/log/codedeploy-agent/codedeploy-agent.log

# View ECS task logs
aws logs tail /ecs/stellar-save-backend-staging --follow
```

### Common Issues

#### ❌ Deployment Failed - CodeDeploy Agent Not Running

**Solution**: Start the CodeDeploy agent on EC2 instances
```bash
sudo service codedeploy-agent start
sudo service codedeploy-agent status
```

#### ❌ Rollback Triggered Unexpectedly

**Check**:
1. Verify CloudWatch alarm threshold
2. Review application logs for 5xx errors
3. Check ALB target health
```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:...
```

#### ❌ Traffic Not Shifting to Green

**Check**:
1. Verify target group health checks pass
2. Confirm ALB listener rules
3. Check security group rules
```bash
# Verify ECS service deployment status
aws ecs describe-services \
  --cluster stellar-save-staging \
  --services stellar-save-backend-staging
```

## Cost Optimization

### Estimated Monthly Costs

| Component | Staging | Production |
|-----------|---------|---|
| CodeDeploy (100 deployments/month) | ~$5 | ~$5 |
| ALB (including new requests) | ~$15 | ~$60 |
| EC2 instances (2x during deployment) | ~$30 | ~$120 |
| CloudWatch monitoring | ~$5 | ~$10 |
| **Total** | **~$55** | **~$195** |

### Cost-Saving Tips

1. **Reuse instances**: Configure CodeDeploy to reuse blue instances when possible
2. **Right-size instances**: Use appropriate instance types for your workload
3. **Scale to zero**: When not deploying, reduce to 1 instance minimum
4. **Consolidate metrics**: Use namespace-based metrics for better aggregation

## Best Practices

### ✅ Do's

- ✅ Test deployments in staging first
- ✅ Set appropriate error thresholds for your service
- ✅ Monitor alarms during canary phase
- ✅ Use meaningful deployment descriptions
- ✅ Keep deployment packages under 1GB
- ✅ Run health checks before production deployments

### ❌ Don'ts

- ❌ Don't disable automatic rollback in production
- ❌ Don't deploy during business-critical hours without monitoring
- ❌ Don't use overly aggressive canary percentages (stick to 10%)
- ❌ Don't ignore CloudWatch alarms
- ❌ Don't skip testing in staging environment

## Advanced Configuration

### Custom Canary Durations

For different risk profiles:

```hcl
# Fast feedback (aggressive)
canary_duration_minutes     = 2
canary_traffic_percentage   = 5

# Balanced (default)
canary_duration_minutes     = 5
canary_traffic_percentage   = 10

# Cautious (conservative)
canary_duration_minutes     = 15
canary_traffic_percentage   = 5
```

### Custom Error Thresholds

Adjust based on service characteristics:

```hcl
# High-traffic production (e.g., 10k requests/min)
error_rate_threshold = 50  # ~0.5% error rate

# Medium-traffic (e.g., 1k requests/min)
error_rate_threshold = 10  # ~1% error rate

# Low-traffic (e.g., 100 requests/min)
error_rate_threshold = 3   # ~3% error rate
```

## References

- [AWS CodeDeploy Documentation](https://docs.aws.amazon.com/codedeploy/)
- [Blue-Green Deployments on AWS](https://docs.aws.amazon.com/whitepapers/latest/blue-green-deployments/)
- [ECS Deployment Types](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/userguide/AlarmThatSendsEmail.html)

## Support

For issues or questions:
1. Check CloudWatch logs: `/aws/stellar-save/{env}/app`
2. Review deployment history in CodeDeploy console
3. Validate ALB target group health
4. Check IAM permissions
