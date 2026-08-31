variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "load_balancer_name" {
  description = "Name of the Application Load Balancer for CloudWatch metrics"
  type        = string
}

variable "listener_arn" {
  description = "ARN of the ALB production listener for traffic shifting"
  type        = string
}

variable "blue_target_group_name" {
  description = "Name of the blue (current) target group"
  type        = string
}

variable "green_target_group_name" {
  description = "Name of the green (replacement) target group"
  type        = string
}

variable "error_rate_threshold" {
  description = "Number of 5xx errors per minute before triggering rollback (default ~1% at typical traffic)"
  type        = number
  default     = 10
}

variable "canary_traffic_percentage" {
  description = "Percentage of traffic to send to green deployment during canary phase"
  type        = number
  default     = 10
  validation {
    condition     = var.canary_traffic_percentage > 0 && var.canary_traffic_percentage < 100
    error_message = "Canary traffic percentage must be between 1 and 99."
  }
}

variable "canary_duration_minutes" {
  description = "Duration of canary deployment in minutes before full cutover"
  type        = number
  default     = 5
  validation {
    condition     = var.canary_duration_minutes > 0 && var.canary_duration_minutes <= 60
    error_message = "Canary duration must be between 1 and 60 minutes."
  }
}

variable "blue_termination_wait_minutes" {
  description = "Minutes to wait before terminating blue instances after successful deployment"
  type        = number
  default     = 5
  validation {
    condition     = var.blue_termination_wait_minutes >= 0 && var.blue_termination_wait_minutes <= 1440
    error_message = "Blue termination wait time must be between 0 and 1440 minutes (24 hours)."
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
