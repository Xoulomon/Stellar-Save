terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
}

# CodeDeploy Application for ECS services
resource "aws_codedeploy_app" "ecs_app" {
  name             = "stellar-save-${var.environment}"
  compute_platform = "ECS"

  tags = merge(
    var.tags,
    {
      Name        = "stellar-save-codedeploy-${var.environment}"
      Environment = var.environment
    }
  )
}

# CodeDeploy Deployment Group with Blue-Green Configuration
resource "aws_codedeploy_deployment_group" "ecs_deployment_group" {
  app_name               = aws_codedeploy_app.ecs_app.name
  service_role_arn       = aws_iam_role.codedeploy_role.arn
  deployment_group_name  = "stellar-save-backend-${var.environment}"
  deployment_config_name = "CodeDeployDefault.ECSCanary10Percent5Minutes"

  # ECS service reference
  ecs_service {
    cluster_name = "stellar-save-${var.environment}"
    service_name = "stellar-save-backend-${var.environment}"
  }

  # Load balancer configuration for traffic shifting
  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route {
        listener_arns = [var.listener_arn]
      }

      target_group {
        name = var.blue_target_group_name
      }

      target_group {
        name = var.green_target_group_name
      }
    }
  }

  # Blue-Green Deployment Configuration
  blue_green_deployment_config {
    # Termination configuration for old (Blue) instances
    terminate_blue_instances_on_deployment_success {
      action                           = "TERMINATE"
      termination_wait_time_in_minutes = var.blue_termination_wait_minutes
    }

    # Proceed automatically without waiting for manual approval
    deployment_ready_option {
      action_on_timeout = "CONTINUE_DEPLOYMENT"
    }
  }

  # Auto-rollback configuration based on CloudWatch alarms
  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }

  # CloudWatch alarms for automatic rollback
  alarm_configuration {
    enabled = true
    alarms  = [aws_cloudwatch_alarm.high_error_rate.alarm_name]
  }

  # Deployment style
  deployment_style {
    deployment_type   = "BLUE_GREEN"
    deployment_option = "WITH_TRAFFIC_CONTROL"
  }

  tags = merge(
    var.tags,
    {
      Name        = "stellar-save-deployment-group-${var.environment}"
      Environment = var.environment
    }
  )

  depends_on = [aws_iam_role_policy.codedeploy_policy]
}

# CloudWatch Alarm for 5xx error rate > 1%
resource "aws_cloudwatch_alarm" "high_error_rate" {
  alarm_name          = "stellar-save-backend-${var.environment}-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  alarm_description   = "Triggers rollback when 5xx error rate exceeds threshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.load_balancer_name
    TargetGroup  = var.blue_target_group_name
  }

  tags = merge(
    var.tags,
    {
      Name        = "high-error-rate-${var.environment}"
      Environment = var.environment
    }
  )
}

# IAM Role for CodeDeploy
resource "aws_iam_role" "codedeploy_role" {
  name = "stellar-save-codedeploy-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "codedeploy-role-${var.environment}"
      Environment = var.environment
    }
  )
}

# IAM Policy for CodeDeploy to manage ECS deployments
resource "aws_iam_role_policy" "codedeploy_policy" {
  name = "stellar-save-codedeploy-policy-${var.environment}"
  role = aws_iam_role.codedeploy_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeRules",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:ModifyListener",
          "elasticloadbalancing:ModifyRule"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:CreateTaskSet",
          "ecs:DeleteTaskSet",
          "ecs:DescribeServices",
          "ecs:UpdateServicePrimaryTaskSet",
          "ecs:DescribeTaskSets",
          "ecs:ListTaskSets",
          "ecs:RegisterTaskDefinition",
          "ecs:TagResource"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:DescribeAlarms"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = "*"
        Condition = {
          StringLike = {
            "iam:PassedToService" = [
              "ecs-tasks.amazonaws.com"
            ]
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "*"
      }
    ]
  })
}

# Data source for current AWS region
data "aws_region" "current" {}
