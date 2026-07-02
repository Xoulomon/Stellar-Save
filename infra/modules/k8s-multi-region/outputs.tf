output "primary_cluster_name" {
  value = aws_eks_cluster.primary.name
}

output "secondary_cluster_name" {
  value = aws_eks_cluster.secondary.name
}

output "primary_cluster_endpoint" {
  value = aws_eks_cluster.primary.endpoint
}

output "secondary_cluster_endpoint" {
  value = aws_eks_cluster.secondary.endpoint
}

output "api_dns_name" {
  value = var.api_dns_name
}
