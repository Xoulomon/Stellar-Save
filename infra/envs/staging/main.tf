# infra/envs/staging/main.tf

# ── Standard cost-allocation tags ─────────────────────────────────────────────
# Every resource in this environment must carry these tags so AWS Cost Explorer
# can break down spend by service and environment. See docs/tagging-standard.md.
locals {
  common_tags = {
    Project     = "stellar-save"
    Environment = "staging"
    ManagedBy   = "terraform"
    CostCenter  = "engineering"
    Owner       = "platform-team"
    StellarNet  = "testnet"
  }
}

module "rds" {
  source      = "../../modules/rds"
  environment = "staging"

  vpc_id                     = var.vpc_id
  subnet_ids                 = var.private_subnet_ids
  allowed_security_group_ids = var.backend_security_group_ids
  instance_class             = "db.t3.micro"
  allocated_storage          = 20
  multi_az                   = false
  db_username                = var.db_username
  db_password                = var.db_password
  rotation_days              = 30
  aws_region                 = var.aws_region

  tags = merge(local.common_tags, { Service = "rds" })
}

module "frontend" {
  source              = "../../modules/frontend"
  environment         = "staging"
  domain_names        = ["staging.stellar-save.app"]
  acm_certificate_arn = var.acm_certificate_arn

  tags = merge(local.common_tags, { Service = "frontend" })
}

# CodeDeploy Blue-Green Deployment Configuration
module "codedeploy" {
  source = "../../modules/codedeploy-blue-green"

  environment             = "staging"
  load_balancer_name      = var.alb_name != "" ? var.alb_name : "stellar-save-alb-staging"
  listener_arn            = var.listener_arn
  blue_target_group_name  = var.blue_target_group_name != "" ? var.blue_target_group_name : "stellar-save-backend-blue-staging"
  green_target_group_name = var.green_target_group_name != "" ? var.green_target_group_name : "stellar-save-backend-green-staging"

  canary_traffic_percentage     = var.canary_traffic_percentage
  canary_duration_minutes       = var.canary_duration_minutes
  blue_termination_wait_minutes = var.blue_termination_wait_minutes
  error_rate_threshold          = var.error_rate_threshold

  tags = merge(local.common_tags, { Service = "codedeploy" })
}

# ── Budget alerts ─────────────────────────────────────────────────────────────
module "budget_alerts" {
  source = "../../modules/budget-alerts"

  environment           = "staging"
  monthly_budget_usd    = var.monthly_budget_usd
  alert_email_addresses = var.budget_alert_emails
  alert_thresholds_pct  = [50, 80, 100]

  tags = merge(local.common_tags, { Service = "budget-alerts" })
}

# ── Cost breakdown dashboard ──────────────────────────────────────────────────
module "cost_dashboard" {
  source = "../../modules/cost-dashboard"

  environment                = "staging"
  aws_region                 = var.aws_region
  ecs_cluster_name           = "stellar-save-backend-staging"
  ecs_service_name           = "stellar-save-backend-staging"
  rds_instance_identifier    = "stellar-save-staging"
  cloudfront_distribution_id = module.frontend.cloudfront_distribution_id
  budget_sns_topic_arn       = module.budget_alerts.sns_topic_arn
  monthly_budget_usd         = var.monthly_budget_usd

  tags = merge(local.common_tags, { Service = "cost-dashboard" })
}
