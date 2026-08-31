variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "monthly_budget_usd" {
  description = "Total monthly budget cap in USD"
  type        = number
}

variable "alert_email_addresses" {
  description = "Email addresses to notify when a budget threshold is crossed"
  type        = list(string)
}

variable "alert_thresholds_pct" {
  description = "Budget percentage thresholds at which notifications are sent (escalating)"
  type        = list(number)
  default     = [50, 80, 100]
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
