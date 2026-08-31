# infra/modules/rds-read-replica/outputs.tf

output "replica_endpoint" {
  description = "Read replica endpoint (host:port), empty when not created"
  value       = var.create ? "${aws_db_instance.replica[0].address}:${aws_db_instance.replica[0].port}" : ""
}

output "replica_instance_id" {
  description = "Read replica instance identifier, empty when not created"
  value       = var.create ? aws_db_instance.replica[0].id : ""
}

output "replica_arn" {
  description = "Read replica instance ARN, empty when not created"
  value       = var.create ? aws_db_instance.replica[0].arn : ""
}

output "replica_security_group_id" {
  description = "Security group ID attached to the read replica, empty when not created"
  value       = var.create ? aws_security_group.replica[0].id : ""
}
