variable "app_name" {
  description = "Application name prefix for all resources"
  type        = string
}

variable "k8s_version" {
  description = "EKS Kubernetes version"
  type        = string
  default     = "1.30"
}

variable "primary_region" {
  type    = string
  default = "us-east-1"
}

variable "secondary_region" {
  type    = string
  default = "eu-west-1"
}

variable "primary_subnet_ids" {
  type = list(string)
}

variable "secondary_subnet_ids" {
  type = list(string)
}

variable "hosted_zone_id" {
  type = string
}

variable "api_dns_name" {
  type = string
}

variable "primary_api_fqdn" {
  type = string
}

variable "secondary_api_fqdn" {
  type = string
}

variable "primary_lb_dns" {
  type = string
}

variable "primary_lb_zone_id" {
  type = string
}

variable "primary_lb_arn_suffix" {
  type = string
}

variable "secondary_lb_dns" {
  type = string
}

variable "secondary_lb_zone_id" {
  type = string
}

variable "alert_sns_arns" {
  description = "SNS topic ARNs for CloudWatch alarm actions"
  type        = list(string)
  default     = []
}

variable "common_tags" {
  type    = map(string)
  default = {}
}
