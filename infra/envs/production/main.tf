# infra/envs/production/main.tf

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

  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "mainnet"
  }
}

module "frontend" {
  source      = "../../modules/frontend"
  environment = "production"
  domain_names        = ["stellar-save.app", "www.stellar-save.app"]
  acm_certificate_arn = var.acm_certificate_arn
  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "mainnet"
  }
}

# ── CloudWatch Logging Configuration ──────────────────────────────────────────
# Set up centralized logging for ECS tasks and Lambda functions
module "cloudwatch_logging" {
  source                     = "../../modules/cloudwatch-logging"
  environment                = "production"
  app_log_retention_days     = var.app_log_retention_days
  audit_log_retention_days   = var.audit_log_retention_days
  create_alarms              = var.create_cloudwatch_alarms
  critical_error_alarm_threshold = var.critical_error_alarm_threshold
  create_lambda_role         = var.create_lambda_role
  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "mainnet"
    Environment = "production"
  }
}
