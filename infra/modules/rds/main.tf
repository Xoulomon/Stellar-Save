# infra/modules/rds/main.tf
# Reusable module: PostgreSQL RDS instance + Secrets Manager credentials.

locals {
  identifier = "stellar-save-${var.environment}"
}

# ── Subnet group ──────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "this" {
  name       = local.identifier
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Environment = var.environment })
}

# ── Security group ────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${local.identifier}-rds"
  description = "Allow PostgreSQL access from backend"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Environment = var.environment })
}

# ── RDS instance ──────────────────────────────────────────────────────────────
resource "aws_db_instance" "this" {
  identifier        = local.identifier
  engine            = "postgres"
  engine_version    = var.engine_version
  instance_class    = var.instance_class
  allocated_storage = var.allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = var.environment != "production"

  final_snapshot_identifier = var.environment == "production" ? "${local.identifier}-final" : null

  tags = merge(var.tags, { Environment = var.environment })
}

# ── Secrets Manager ───────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.identifier}/db-credentials"
  description             = "PostgreSQL credentials for ${local.identifier}"
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = merge(var.tags, { Environment = var.environment })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username            = var.db_username
    password            = var.db_password
    host                = aws_db_instance.this.address
    port                = aws_db_instance.this.port
    dbname              = var.db_name
    engine              = "postgres"
    dbInstanceIdentifier = aws_db_instance.this.id
  })
}

# ── IAM Role for Lambda Rotation Function ────────────────────────────────────
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rotation_lambda" {
  name               = "${local.identifier}-rotation-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = merge(var.tags, { Environment = var.environment })
}

# Attach AWS managed policy for Lambda VPC execution
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  role       = aws_iam_role.rotation_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom policy for Secrets Manager and RDS access
data "aws_iam_policy_document" "rotation_lambda_policy" {
  statement {
    sid = "SecretsManagerAccess"
    actions = [
      "secretsmanager:DescribeSecret",
      "secretsmanager:GetSecretValue",
      "secretsmanager:PutSecretValue",
      "secretsmanager:UpdateSecretVersionStage"
    ]
    resources = [aws_secretsmanager_secret.db_credentials.arn]
  }

  statement {
    sid = "GetRandomPassword"
    actions = [
      "secretsmanager:GetRandomPassword"
    ]
    resources = ["*"]
  }

  statement {
    sid = "RDSAccess"
    actions = [
      "rds:DescribeDBInstances",
      "rds:ModifyDBInstance"
    ]
    resources = [aws_db_instance.this.arn]
  }
}

resource "aws_iam_role_policy" "rotation_lambda" {
  name   = "rotation-permissions"
  role   = aws_iam_role.rotation_lambda.id
  policy = data.aws_iam_policy_document.rotation_lambda_policy.json
}

# ── Security Group for Lambda ─────────────────────────────────────────────────
resource "aws_security_group" "rotation_lambda" {
  name        = "${local.identifier}-rotation-lambda"
  description = "Security group for secrets rotation Lambda"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Environment = var.environment })
}

# Allow Lambda to connect to RDS
resource "aws_security_group_rule" "lambda_to_rds" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.rotation_lambda.id
  security_group_id        = aws_security_group.rds.id
  description              = "Allow Lambda rotation function to access RDS"
}

# ── Lambda Function for Rotation ──────────────────────────────────────────────
resource "aws_lambda_function" "rotation" {
  filename         = "${path.module}/rotation_lambda.zip"
  function_name    = "${local.identifier}-rotation"
  role             = aws_iam_role.rotation_lambda.arn
  handler          = "index.handler"
  source_code_hash = filebase64sha256("${path.module}/rotation_lambda.zip")
  runtime          = "python3.11"
  timeout          = 30

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.rotation_lambda.id]
  }

  environment {
    variables = {
      SECRETS_MANAGER_ENDPOINT = "https://secretsmanager.${var.aws_region}.amazonaws.com"
    }
  }

  tags = merge(var.tags, { Environment = var.environment })
}

# Grant Secrets Manager permission to invoke Lambda
resource "aws_lambda_permission" "secrets_manager" {
  statement_id  = "AllowSecretsManagerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotation.function_name
  principal     = "secretsmanager.amazonaws.com"
}

# ── Secrets Rotation Configuration ────────────────────────────────────────────
resource "aws_secretsmanager_secret_rotation" "db_credentials" {
  secret_id           = aws_secretsmanager_secret.db_credentials.id
  rotation_lambda_arn = aws_lambda_function.rotation.arn

  rotation_rules {
    automatically_after_days = var.rotation_days
  }

  depends_on = [aws_lambda_permission.secrets_manager]
}
