# infra/environments/staging.tfvars
# Variable values for the staging environment.
# Usage: terraform plan -var-file=../../environments/staging.tfvars
#        terraform apply -var-file=../../environments/staging.tfvars

aws_region = "us-east-1"

# RDS — reduced scale for pre-release testing
db_instance_class  = "db.t3.micro"
allocated_storage  = 20
multi_az           = false

# Frontend
domain_names = ["staging.stellar-save.app"]

# Stellar network
stellar_network = "testnet"
