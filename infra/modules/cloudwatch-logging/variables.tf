variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "app_log_retention_days" {
  description = "Retention period in days for application logs"
  type        = number
  default     = 30
}

variable "audit_log_retention_days" {
  description = "Retention period in days for audit logs"
  type        = number
  default     = 90
}

variable "ecs_task_execution_role_id" {
  description = "IAM role ID for ECS task execution"
  type        = string
}

variable "lambda_execution_role_id" {
  description = "IAM role ID for Lambda execution (optional)"
  type        = string
  default     = null
}

variable "create_alarms" {
  description = "Whether to create CloudWatch alarms for critical errors"
  type        = bool
  default     = true
}

variable "critical_error_alarm_threshold" {
  description = "Threshold for critical error alarm"
  type        = number
  default     = 1
}

variable "create_lambda_role" {
  description = "Whether to create Lambda execution role"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "stellar-save"
    ManagedBy = "terraform"
  }
}
