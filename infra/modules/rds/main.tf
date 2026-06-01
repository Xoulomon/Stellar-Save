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
    username = var.db_username
    password = var.db_password
    host     = aws_db_instance.this.address
    port     = aws_db_instance.this.port
    dbname   = var.db_name
  })
}
