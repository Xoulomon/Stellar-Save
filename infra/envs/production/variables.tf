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

# CodeDeploy Configuration
variable "alb_name" {
  description = "Name of the Application Load Balancer (optional - uses default if not provided)"
  type        = string
  default     = ""
}

variable "listener_arn" {
  description = "ARN of the ALB production listener for CodeDeploy traffic shifting"
  type        = string
}

variable "blue_target_group_name" {
  description = "Name of the blue (current) target group (optional - uses default if not provided)"
  type        = string
  default     = ""
}

variable "green_target_group_name" {
  description = "Name of the green (replacement) target group (optional - uses default if not provided)"
  type        = string
  default     = ""
}

variable "canary_traffic_percentage" {
  description = "Percentage of traffic to shift to green during canary phase"
  type        = number
  default     = 10
}

variable "canary_duration_minutes" {
  description = "Duration of canary phase in minutes"
  type        = number
  default     = 5
}

variable "blue_termination_wait_minutes" {
  description = "Minutes to wait before terminating blue instances"
  type        = number
  default     = 5
}

variable "error_rate_threshold" {
  description = "Number of 5xx errors per minute to trigger automatic rollback"
  type        = number
  default     = 10
}
