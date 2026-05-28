# infra/envs/staging/variables.tf

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for staging.stellar-save.app (us-east-1)"
  type        = string
  default     = ""
}

variable "vpc_id" {
  description = "VPC ID for RDS deployment"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "backend_security_group_ids" {
  description = "Security group IDs of backend services allowed to connect to RDS"
  type        = list(string)
  default     = []
}

variable "db_username" {
  description = "Master DB username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Master DB password"
  type        = string
  sensitive   = true
}
