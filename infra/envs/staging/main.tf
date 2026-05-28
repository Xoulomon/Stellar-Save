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
