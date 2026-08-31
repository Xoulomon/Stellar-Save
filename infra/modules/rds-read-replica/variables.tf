# infra/modules/rds-read-replica/variables.tf
# Variables for the cross-region RDS read replica module.

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "create" {
  description = "Whether to actually create the cross-region read replica. Defaults false so single-region deploys are unaffected."
  type        = bool
  default     = false
}

variable "source_db_arn" {
  description = "ARN of the source (primary region) RDS instance to replicate from. Cross-region replication requires the full ARN."
  type        = string
}

variable "replica_region" {
  description = "AWS region the read replica is created in (must match the aws.replica provider region)."
  type        = string
}

variable "instance_class" {
  description = "Instance class for the read replica"
  type        = string
  default     = "db.t3.small"
}

variable "vpc_id" {
  description = "VPC ID in the replica region"
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs in the replica region for the DB subnet group"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs in the replica region allowed to reach PostgreSQL"
  type        = list(string)
  default     = []
}

variable "kms_key_id" {
  description = "KMS key ID/ARN in the replica region used to encrypt the replica's storage. Required because the source is encrypted; leave empty to use the region's default RDS KMS key."
  type        = string
  default     = ""
}

variable "multi_az" {
  description = "Enable Multi-AZ for the read replica"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}
