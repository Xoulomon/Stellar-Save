# infra/envs/staging/provider.tf

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  backend "s3" {
    bucket         = "stellar-save-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "stellar-save-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # Default tags applied to every resource — satisfies the cost-allocation
  # tagging standard. Module-specific tags (Service) are merged on top.
  default_tags {
    tags = {
      Project     = "stellar-save"
      Environment = "staging"
      ManagedBy   = "terraform"
      CostCenter  = "engineering"
      Owner       = "platform-team"
    }
  }
}
