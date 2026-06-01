# infra/envs/staging/main.tf

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

  tags = {
    Project    = "stellar-save"
    ManagedBy  = "terraform"
    StellarNet = "testnet"
  }
}

module "frontend" {
  source      = "../../modules/frontend"
  environment = "staging"
  domain_names        = ["staging.stellar-save.app"]
  acm_certificate_arn = var.acm_certificate_arn
  tags = {
    Project     = "stellar-save"
    ManagedBy   = "terraform"
    StellarNet  = "testnet"
  }
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

  tags = {
    Project     = "stellar-save"
    ManagedBy   = "terraform"
    StellarNet  = "testnet"
  }
}
