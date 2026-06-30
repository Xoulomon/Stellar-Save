# infra/envs/production/main.tf

# ── Standard cost-allocation tags ─────────────────────────────────────────────
# Every resource in this environment must carry these tags so AWS Cost Explorer
# can break down spend by service and environment. See docs/tagging-standard.md.
locals {
  common_tags = {
    Project     = "stellar-save"
    Environment = "production"
    ManagedBy   = "terraform"
    CostCenter  = "engineering"
    Owner       = "platform-team"
    StellarNet  = "mainnet"
  }
}

module "rds" {
  source      = "../../modules/rds"
  environment = "production"

  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = var.backend_security_group_ids
  instance_class             = "db.t3.small"
  allocated_storage          = 20
  multi_az                   = true
  db_username                = var.db_username
  db_password                = var.db_password

  tags = merge(local.common_tags, { Service = "rds" })
}

module "frontend" {
  source              = "../../modules/frontend"
  environment         = "production"
  domain_names        = ["stellar-save.app", "www.stellar-save.app"]
  acm_certificate_arn = var.acm_certificate_arn

  tags = merge(local.common_tags, { Service = "frontend" })
}

# ── Cross-region read replica (secondary region) ──────────────────────────────
# Disabled by default; enable via enable_cross_region_replica = true.
module "rds_read_replica" {
  source = "../../modules/rds-read-replica"

  providers = {
    aws.replica = aws.secondary
  }

  environment    = "production"
  create         = var.enable_cross_region_replica
  source_db_arn  = module.rds.db_instance_arn
  replica_region = var.secondary_aws_region

  instance_class             = "db.t3.small"
  multi_az                   = true
  vpc_id                     = var.replica_vpc_id
  subnet_ids                 = var.replica_subnet_ids
  allowed_security_group_ids = var.replica_security_group_ids
  kms_key_id                 = var.replica_kms_key_id

  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "mainnet"
  }
}

# ── Multi-region Route53 geo/latency routing + health-check failover ──────────
# Disabled by default; enable via enable_multi_region = true.
module "multi_region" {
  source = "../../modules/multi-region"
  count  = var.enable_multi_region ? 1 : 0

  environment    = "production"
  hosted_zone_id = var.hosted_zone_id
  record_name    = var.routing_record_name
  routing_policy = var.routing_policy

  regions = {
    "${var.aws_region}-primary" = {
      aws_region          = var.aws_region
      endpoint_domain     = var.primary_endpoint_domain
      geolocation_default = true
    }
    "${var.secondary_aws_region}-secondary" = {
      aws_region            = var.secondary_aws_region
      endpoint_domain       = var.secondary_endpoint_domain
      geolocation_continent = "EU"
    }
  }

  # Also expose an explicit PRIMARY/SECONDARY failover record set.
  enable_dns_failover    = true
  failover_primary_key   = "${var.aws_region}-primary"
  failover_secondary_key = "${var.secondary_aws_region}-secondary"

  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "mainnet"
  }
}

# CodeDeploy Blue-Green Deployment Configuration
module "codedeploy" {
  source = "../../modules/codedeploy-blue-green"

  environment             = "production"
  load_balancer_name      = var.alb_name != "" ? var.alb_name : "stellar-save-alb-production"
  listener_arn            = var.listener_arn
  blue_target_group_name  = var.blue_target_group_name != "" ? var.blue_target_group_name : "stellar-save-backend-blue-production"
  green_target_group_name = var.green_target_group_name != "" ? var.green_target_group_name : "stellar-save-backend-green-production"

  canary_traffic_percentage     = var.canary_traffic_percentage
  canary_duration_minutes       = var.canary_duration_minutes
  blue_termination_wait_minutes = var.blue_termination_wait_minutes
  error_rate_threshold          = var.error_rate_threshold

  tags = merge(local.common_tags, { Service = "codedeploy" })
}

# ── Budget alerts ─────────────────────────────────────────────────────────────
module "budget_alerts" {
  source = "../../modules/budget-alerts"

  environment           = "production"
  monthly_budget_usd    = var.monthly_budget_usd
  alert_email_addresses = var.budget_alert_emails
  alert_thresholds_pct  = [50, 80, 100]

  tags = merge(local.common_tags, { Service = "budget-alerts" })
}

# ── Cost breakdown dashboard ──────────────────────────────────────────────────
module "cost_dashboard" {
  source = "../../modules/cost-dashboard"

  environment                = "production"
  aws_region                 = var.aws_region
  ecs_cluster_name           = "stellar-save-backend-production"
  ecs_service_name           = "stellar-save-backend-production"
  rds_instance_identifier    = "stellar-save-production"
  cloudfront_distribution_id = module.frontend.cloudfront_distribution_id
  budget_sns_topic_arn       = module.budget_alerts.sns_topic_arn
  monthly_budget_usd         = var.monthly_budget_usd

  tags = merge(local.common_tags, { Service = "cost-dashboard" })
}
