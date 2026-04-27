# infra/envs/production/main.tf

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
