# infra/envs/production/variables.tf

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for stellar-save.app (us-east-1)"
  type        = string
}
