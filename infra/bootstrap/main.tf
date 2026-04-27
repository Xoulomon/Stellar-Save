# infra/bootstrap/main.tf
# One-time setup: creates the S3 bucket and DynamoDB table used as the
# Terraform remote state backend for all environments.
# Run once manually: cd infra/bootstrap && terraform init && terraform apply

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
  # Bootstrap uses local state — it manages the remote state backend itself.
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

# ── State bucket ──────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "state" {
  bucket        = "stellar-save-terraform-state"
  force_destroy = false
  tags          = { Project = "stellar-save", ManagedBy = "terraform" }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── DynamoDB lock table ───────────────────────────────────────────────────────
resource "aws_dynamodb_table" "locks" {
  name         = "stellar-save-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = { Project = "stellar-save", ManagedBy = "terraform" }
}

output "state_bucket" { value = aws_s3_bucket.state.id }
output "lock_table"   { value = aws_dynamodb_table.locks.name }
