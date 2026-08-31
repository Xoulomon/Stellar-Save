# infra/modules/k8s-multi-region/main.tf
#
# Multi-region Kubernetes cluster management with automated failover
# and cross-cluster load balancing.
#
# closes #1179

terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

# ── Primary cluster (EKS) ────────────────────────────────────────────────────

resource "aws_eks_cluster" "primary" {
  name     = "${var.app_name}-primary-${var.primary_region}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = var.k8s_version

  vpc_config {
    subnet_ids = var.primary_subnet_ids
  }

  tags = merge(var.common_tags, { Region = var.primary_region, Role = "primary" })
}

# ── Secondary / DR cluster ───────────────────────────────────────────────────

resource "aws_eks_cluster" "secondary" {
  provider = aws.secondary
  name     = "${var.app_name}-secondary-${var.secondary_region}"
  role_arn = aws_iam_role.eks_cluster_secondary.arn
  version  = var.k8s_version

  vpc_config {
    subnet_ids = var.secondary_subnet_ids
  }

  tags = merge(var.common_tags, { Region = var.secondary_region, Role = "secondary" })
}

# ── IAM roles ────────────────────────────────────────────────────────────────

resource "aws_iam_role" "eks_cluster" {
  name               = "${var.app_name}-eks-primary"
  assume_role_policy = data.aws_iam_policy_document.eks_assume.json
}

resource "aws_iam_role" "eks_cluster_secondary" {
  provider           = aws.secondary
  name               = "${var.app_name}-eks-secondary"
  assume_role_policy = data.aws_iam_policy_document.eks_assume.json
}

resource "aws_iam_role_policy_attachment" "eks_primary" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_secondary" {
  provider   = aws.secondary
  role       = aws_iam_role.eks_cluster_secondary.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

data "aws_iam_policy_document" "eks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

# ── Route 53 health-check + failover routing ─────────────────────────────────

resource "aws_route53_health_check" "primary" {
  fqdn              = var.primary_api_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = merge(var.common_tags, { Name = "${var.app_name}-hc-primary" })
}

resource "aws_route53_health_check" "secondary" {
  fqdn              = var.secondary_api_fqdn
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30

  tags = merge(var.common_tags, { Name = "${var.app_name}-hc-secondary" })
}

resource "aws_route53_record" "api_primary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
  type    = "A"

  failover_routing_policy {
    type = "PRIMARY"
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "primary"

  alias {
    name                   = var.primary_lb_dns
    zone_id                = var.primary_lb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_secondary" {
  zone_id = var.hosted_zone_id
  name    = var.api_dns_name
  type    = "A"

  failover_routing_policy {
    type = "SECONDARY"
  }

  health_check_id = aws_route53_health_check.secondary.id
  set_identifier  = "secondary"

  alias {
    name                   = var.secondary_lb_dns
    zone_id                = var.secondary_lb_zone_id
    evaluate_target_health = true
  }
}

# ── CloudWatch alarms for cluster health ─────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "primary_unhealthy" {
  alarm_name          = "${var.app_name}-primary-cluster-unhealthy"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnhealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Primary EKS cluster has unhealthy targets"
  alarm_actions       = var.alert_sns_arns

  dimensions = {
    LoadBalancer = var.primary_lb_arn_suffix
  }

  tags = var.common_tags
}
