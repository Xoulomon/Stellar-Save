# Example ECS Task Definition with CloudWatch Log Configuration
# This file demonstrates how to configure awslogs log driver in ECS task definitions

# ── ECS Task Definition with awslogs driver ───────────────────────────────────
# Update your existing ECS task definitions to use this log configuration

locals {
  # Log configuration for ECS tasks
  ecs_log_configuration = {
    logDriver = "awslogs"
    options = {
      "awslogs-group"         = module.cloudwatch_logging.app_log_group_name
      "awslogs-region"        = data.aws_region.current.name
      "awslogs-stream-prefix" = "ecs/${var.environment}"
    }
  }
}

# ── Example: API Server Task Definition ───────────────────────────────────────
# resource "aws_ecs_task_definition" "api_server" {
#   family                   = "stellar-save-api-server-${var.environment}"
#   network_mode             = "awsvpc"
#   requires_compatibilities = ["FARGATE"]
#   cpu                      = "256"
#   memory                   = "512"
#   execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
#   task_role_arn            = aws_iam_role.ecs_task_role.arn
#
#   container_definitions = jsonencode([
#     {
#       name      = "api-server"
#       image     = "stellar-save:${var.image_tag}"
#       essential = true
#       portMappings = [
#         {
#           containerPort = 3000
#           protocol      = "tcp"
#         }
#       ]
#
#       # CloudWatch Log Configuration
#       logConfiguration = local.ecs_log_configuration
#
#       environment = [
#         {
#           name  = "ENVIRONMENT"
#           value = var.environment
#         }
#       ]
#     }
#   ])
#
#   tags = merge(
#     var.tags,
#     {
#       Name = "stellar-save-api-server-${var.environment}"
#     }
#   )
# }

# ── IAM Role for ECS Task Execution ───────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "stellar-save-ecs-task-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Principal"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "stellar-save-ecs-task-execution-role-${var.environment}"
    }
  )
}

# ── Attach CloudWatch Logs Policy to Execution Role ───────────────────────────
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_logs_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
}

# ── Attach ECS Task Execution Policy ──────────────────────────────────────────
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── IAM Role for ECS Task (Application) ───────────────────────────────────────
resource "aws_iam_role" "ecs_task_role" {
  name = "stellar-save-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Principal"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "stellar-save-ecs-task-role-${var.environment}"
    }
  )
}

# ── Lambda Execution Role (if using Lambda functions) ───────────────────────────
resource "aws_iam_role" "lambda_execution_role" {
  count = var.create_lambda_role ? 1 : 0
  name  = "stellar-save-lambda-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Principal"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "stellar-save-lambda-execution-role-${var.environment}"
    }
  )
}

# ── Attach CloudWatch Logs Policy to Lambda Role ──────────────────────────────
resource "aws_iam_role_policy_attachment" "lambda_logs_policy" {
  count      = var.create_lambda_role ? 1 : 0
  role       = aws_iam_role.lambda_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_region" "current" {}
