# SSL Certificate Rotation & OCSP Stapling

Automated certificate lifecycle management for the Stellar-Save backend and CDN,
including OCSP stapling configuration for improved TLS handshake performance.

---

## Architecture Overview

```
Internet ──→ CloudFront (CDN)          ──→ ALB (ECS backend)
              ↳ ACM cert auto-renewed       ↳ ACM cert auto-renewed
              ↳ OCSP stapling on             ↳ OCSP stapling on
              ↳ Expiry alarm (30d / 7d)      ↳ Expiry alarm (30d / 7d)
```

AWS Certificate Manager (ACM) handles fully-automated certificate issuance and
renewal using DNS validation via Route 53. No manual rotation steps are
required under normal operation.

---

## Certificate Configuration

### Requesting a Certificate

Certificates are provisioned by the Terraform module at
`infra/modules/tls-cert-rotation/`. The module:

1. Creates an ACM certificate with DNS validation.
2. Automatically creates the required Route 53 CNAME validation record.
3. Waits for validation to complete before the resource is considered ready.

```hcl
module "tls_cert" {
  source      = "../../modules/tls-cert-rotation"
  domain_name = "api.stellar-save.io"
  subject_alternative_names = [
    "www.stellar-save.io",
    "*.stellar-save.io",
  ]
  route53_zone_id     = var.route53_zone_id
  alarm_sns_topic_arn = var.ops_alerts_topic_arn
}
```

### ACM Auto-Renewal

ACM automatically renews managed certificates 60 days before expiry when DNS
validation is active. No manual intervention is required.

**Important**: ACM validation records must remain in Route 53. Never delete
the `_acme-challenge.*` CNAME records — their absence will prevent renewal
and cause service interruption 60 days before expiry.

---

## OCSP Stapling

### What It Does

OCSP stapling allows the web server / load balancer to pre-fetch and cache the
certificate's revocation status, eliminating the extra client-to-CA round-trip
during the TLS handshake. This reduces connection setup latency by 100–300 ms
on first-load connections.

### CloudFront

OCSP stapling is **enabled by default** on all CloudFront distributions.
No additional configuration is required.

Verify it is active:

```bash
openssl s_client -connect stellar-save.io:443 -status < /dev/null 2>&1 \
  | grep -A 4 "OCSP Response"
```

Expected output:

```
OCSP Response Status: successful (0x0)
This Update: Jun 29 00:00:00 2026 GMT
Next Update: Jul  6 00:00:00 2026 GMT
```

### Application Load Balancer (ALB)

OCSP stapling on ALBs is managed by AWS and enabled automatically when the
certificate is provisioned via ACM. Confirm:

```bash
openssl s_client -connect api.stellar-save.io:443 -status < /dev/null 2>&1 \
  | grep "OCSP Response Status"
```

### nginx / Custom Server (self-hosted)

If running a custom nginx instance, add to the `server` block:

```nginx
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

Verify with:

```bash
nginx -t && systemctl reload nginx
```

---

## Monitoring & Alerts

Two CloudWatch alarms are provisioned per certificate by the Terraform module:

| Alarm | Threshold | SNS Topic |
|---|---|---|
| `CertExpiry30d` | Days until expiry ≤ 30 | `ops-alerts` |
| `CertExpiry7d` | Days until expiry ≤ 7 | `ops-alerts` (CRITICAL) |

### Lambda Expiry Monitor

The module deploys a scheduled Lambda (`cert-expiry-monitor`) that runs daily
and publishes the `CertificateDaysUntilExpiry` custom metric to CloudWatch.

The Lambda checks all ACM certificates in the account and publishes one data
point per certificate:

```
Namespace : StellarSave/TLS
MetricName: CertificateDaysUntilExpiry
Dimensions: Domain=api.stellar-save.io
```

View current certificate status:

```bash
aws cloudwatch get-metric-statistics \
  --namespace StellarSave/TLS \
  --metric-name CertificateDaysUntilExpiry \
  --dimensions Name=Domain,Value=api.stellar-save.io \
  --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time   $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 86400 \
  --statistics Minimum
```

---

## Failover Procedure

### Scenario: Automated Renewal Fails

1. **Detect**: `CertExpiry7d` alarm fires → oncall is paged.
2. **Diagnose**: Check that the Route 53 validation CNAME is still present.
   ```bash
   aws route53 list-resource-record-sets \
     --hosted-zone-id $ZONE_ID \
     --query "ResourceRecordSets[?Type=='CNAME']"
   ```
3. **Restore record** (if missing):
   ```bash
   terraform -chdir=infra/envs/production apply -target=module.tls_cert
   ```
4. **Force re-validation** (ACM console or CLI):
   ```bash
   aws acm resend-validation-email \
     --certificate-arn $CERT_ARN \
     --domain api.stellar-save.io \
     --validation-domain stellar-save.io
   ```
5. **Verify**: Wait for ACM status to change to `ISSUED` (typically < 5 min
   with DNS validation).

### Scenario: Certificate Compromised

1. Revoke immediately in the ACM console or via CLI:
   ```bash
   aws acm delete-certificate --certificate-arn $CERT_ARN
   ```
2. Request a replacement:
   ```bash
   terraform -chdir=infra/envs/production apply -target=module.tls_cert
   ```
3. Update CloudFront distribution and ALB listener to reference the new ARN:
   ```bash
   terraform -chdir=infra/envs/production apply
   ```
4. Confirm the new certificate is in use:
   ```bash
   echo | openssl s_client -connect api.stellar-save.io:443 2>/dev/null \
     | openssl x509 -noout -serial -dates
   ```
5. Log the incident in the security incident tracker and notify affected users
   if session hijacking is suspected.

---

## Testing the Certificate Rotation

Run the cert rotation smoke test script after any infra apply:

```bash
./scripts/ssl_rotation_test.sh api.stellar-save.io
```

The script verifies:
- TLS 1.2 and TLS 1.3 handshake succeeds
- OCSP stapling response is present and valid
- Certificate expiry is > 30 days
- Subject Alternative Names include all expected domains

---

## Related Documentation

- [Infrastructure as Code](./iac.md)
- [Security Guide](./security-guide.md)
- [Disaster Recovery](./disaster-recovery.md)
- [Runbooks / Key Compromise](./runbooks/key-compromise.md)
