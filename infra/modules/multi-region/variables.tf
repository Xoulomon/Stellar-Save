# infra/modules/multi-region/variables.tf
# Variables for the multi-region Route53 geo-routing + health-check failover module.

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID that owns the application domain"
  type        = string
}

variable "record_name" {
  description = "FQDN clients connect to and that traffic is routed for (e.g. api.stellar-save.app)"
  type        = string
}

variable "record_ttl" {
  description = "TTL (seconds) for the routing records. Lower values speed up failover at the cost of more DNS queries."
  type        = number
  default     = 60
}

variable "routing_policy" {
  description = "Primary routing strategy for the main record set: 'latency' (nearest healthy region) or 'geolocation' (region by client location)."
  type        = string
  default     = "latency"
  validation {
    condition     = contains(["latency", "geolocation"], var.routing_policy)
    error_message = "routing_policy must be 'latency' or 'geolocation'."
  }
}

# Map of regions participating in routing. The map KEY is used as the Route53
# set identifier (e.g. "us-east-1-primary"), so keep it stable and unique.
variable "regions" {
  description = "Per-region endpoints and health-check settings. Map key is the Route53 set identifier."
  type = map(object({
    aws_region      = string
    endpoint_domain = string # Per-region ALB DNS name or CloudFront domain for this region

    # Health check tuning (sensible defaults below)
    health_check_path     = optional(string, "/health")
    health_check_port     = optional(number, 443)
    health_check_type     = optional(string, "HTTPS")
    request_interval      = optional(number, 30)
    failure_threshold     = optional(number, 3)
    measure_latency       = optional(bool, true)

    # Geolocation routing only: the client location served by this region.
    # Set geolocation_default = true on exactly one region to catch all
    # locations not matched by a continent/country.
    geolocation_continent = optional(string)
    geolocation_country   = optional(string)
    geolocation_default   = optional(bool, false)
  }))
}

# ── Explicit PRIMARY/SECONDARY DNS failover record set ────────────────────────
# Optional, additive alternative/companion to latency routing. When enabled,
# a dedicated record name resolves to the primary region while its health check
# is healthy, and automatically fails over to the secondary region otherwise.
variable "enable_dns_failover" {
  description = "Create an explicit PRIMARY/SECONDARY Route53 failover record set in addition to the main routing records."
  type        = bool
  default     = false
}

variable "failover_record_name" {
  description = "FQDN for the explicit failover record set (defaults to 'failover.<record_name>' when empty)."
  type        = string
  default     = ""
}

variable "failover_primary_key" {
  description = "Key in var.regions to use as the PRIMARY region for the explicit failover record set."
  type        = string
  default     = ""
}

variable "failover_secondary_key" {
  description = "Key in var.regions to use as the SECONDARY region for the explicit failover record set."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional resource tags"
  type        = map(string)
  default     = {}
}
