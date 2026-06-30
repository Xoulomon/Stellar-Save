# infra/modules/rds-read-replica/main.tf
# Reusable module: cross-region, read-only RDS PostgreSQL replica.
#
# Complements modules/rds. The primary database lives in the main region; this
# module stands up a read-only replica in a SECONDARY region for low-latency
# reads and for promotion to a standalone primary during a regional failover.
#
# All resources are gated by var.create (default false) so existing
# single-region environments continue to plan/apply unchanged. The resources
# are pinned to the aws.replica provider alias, which the caller must configure
# for the secondary region.

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.replica]
    }
  }
}

locals {
  identifier = "stellar-save-${var.environment}-replica"
  enabled    = var.create ? 1 : 0
}

# ── Subnet group (replica region) ─────────────────────────────────────────────
resource "aws_db_subnet_group" "replica" {
  provider = aws.replica
  count    = local.enabled

  name       = local.identifier
  subnet_ids = var.subnet_ids

  tags = merge(var.tags, { Environment = var.environment })
}

# ── Security group (replica region) ───────────────────────────────────────────
resource "aws_security_group" "replica" {
  provider = aws.replica
  count    = local.enabled

  name        = "${local.identifier}-rds"
  description = "Allow PostgreSQL access to the cross-region read replica"
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

# ── Cross-region read replica ─────────────────────────────────────────────────
resource "aws_db_instance" "replica" {
  provider = aws.replica
  count    = local.enabled

  identifier          = local.identifier
  instance_class      = var.instance_class
  replicate_source_db = var.source_db_arn

  # Storage / encryption: the source is encrypted, so a replica-region KMS key
  # is required. Falls back to the region's default RDS KMS key when empty.
  storage_encrypted = true
  kms_key_id        = var.kms_key_id != "" ? var.kms_key_id : null

  db_subnet_group_name   = aws_db_subnet_group.replica[0].name
  vpc_security_group_ids = [aws_security_group.replica[0].id]

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = true

  # Read replicas inherit credentials from the source; do not set username/password.
  tags = merge(var.tags, { Environment = var.environment, Role = "read-replica" })
}
