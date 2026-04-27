# infra/envs/staging/main.tf

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
