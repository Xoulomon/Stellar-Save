variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "aws_region" {
  description = "AWS region where the ECS/RDS resources live"
  type        = string
  default     = "us-east-1"
}

variable "ecs_cluster_name" {
  description = "Name of the ECS cluster to show metrics for"
  type        = string
}

variable "ecs_service_name" {
  description = "Name of the ECS service to show metrics for"
  type        = string
}

variable "rds_instance_identifier" {
  description = "RDS instance identifier to show metrics for"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID to show metrics for"
  type        = string
}

variable "budget_sns_topic_arn" {
  description = "ARN of the SNS topic for budget alerts (shown on the dashboard)"
  type        = string
  default     = ""
}

variable "monthly_budget_usd" {
  description = "Monthly budget cap in USD (used to render cost gauge thresholds)"
  type        = number
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
