# infra/environments/staging.backend.hcl
# Partial backend configuration for the staging workspace.
# Usage: terraform init -backend-config=../../environments/staging.backend.hcl
#
# The S3 bucket and DynamoDB table are created by infra/bootstrap/main.tf.

bucket         = "stellar-save-terraform-state"
key            = "staging/terraform.tfstate"
region         = "us-east-1"
dynamodb_table = "stellar-save-terraform-locks"
encrypt        = true
