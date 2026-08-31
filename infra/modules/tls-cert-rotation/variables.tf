variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name for the ACM certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domain names to include in the certificate SANs"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID used to create DNS validation records"
  type        = string
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN that receives certificate expiry alarm notifications"
  type        = string
}

variable "tags" {
  description = "Tags applied to all resources in this module"
  type        = map(string)
  default     = {}
}
