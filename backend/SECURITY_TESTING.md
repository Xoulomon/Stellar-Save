# Security Features Testing Guide

This guide covers testing procedures for security issues #1102, #1103, #1104, and #1105.

## Table of Contents

1. [Setup](#setup)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [Manual Testing](#manual-testing)
5. [CI/CD Testing](#cicd-testing)
6. [Production Validation](#production-validation)

---

## Setup

### Prerequisites

```bash
# Install dependencies
cd backend
npm install

# Setup test database
docker-compose -f test/docker-compose.test.yml up -d

# Configure environment
cp .env.example .env
# Edit .env with your test configuration
```

### AWS Setup (for Secrets Manager tests)

```bash
# Install LocalStack for local AWS testing
pip install localstack awscli-local

# Start LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Create test secrets
awslocal secretsmanager create-secret \
  --name stellar-save/test-jwt-secret \
  --secret-string "test-secret-value-min-32-characters-long"
```

---

## Unit Tests

### Run All Unit Tests

```bash
npm test
```

### Test Individual Components

#### Input Sanitization (#1103)

```bash
npm test -- input-sanitization.test.ts
```

**Expected results:**
- ✅ XSS patterns are detected and encoded
- ✅ SQL injection attempts are blocked
- ✅ Group metadata is sanitized
- ✅ Profile data is sanitized
- ✅ Comments are sanitized with length limits
- ✅ URLs are validated for safe protocols

#### Transaction Decoder (#1102)

```bash
npm test -- transaction-decoder.test.ts
```

**Expected results:**
- ✅ Payment operations decoded correctly
- ✅ Large amounts flagged as high risk
- ✅ Unrecognized addresses trigger warnings
- ✅ Contract invocations are decoded
- ✅ Security operations flagged appropriately
- ✅ Origin validation works

#### Secrets Manager (#1105)

```bash
# With LocalStack running
npm test -- secrets-manager.test.ts
```

**Expected results:**
- ✅ Secrets retrieved from AWS
- ✅ Caching works correctly
- ✅ Secret updates clear cache
- ✅ Rotation can be triggered
- ✅ Batch operations succeed
- ✅ Error handling works

---

## Integration Tests

### Security Endpoints

Create test file: `backend/test/integration/security.test.ts`

```typescript
import request from 'supertest';
import { app } from '../../src/app';

describe('Security API Integration', () => {
  describe('Transaction Decoding', () => {
    it('should decode valid transaction', async () => {
      const response = await request(app)
        .post('/api/decode-transaction')
        .send({
          xdr: 'VALID_TRANSACTION_XDR',
          origin: 'https://app.stellar-save.com',
        })
        .expect(200);

      expect(response.body.decoded).toBeDefined();
      expect(response.body.validation).toBeDefined();
    });

    it('should reject invalid XDR', async () => {
      await request(app)
        .post('/api/decode-transaction')
        .send({ xdr: 'invalid-xdr' })
        .expect(400);
    });

    it('should detect phishing origins', async () => {
      const response = await request(app)
        .post('/api/validate-origin')
        .send({ origin: 'https://phishing-site.com' })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.reason).toContain('phishing');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS in group creation', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', 'Bearer VALID_JWT')
        .send({
          name: '<script>alert("xss")</script>Test Group',
          description: 'Normal description',
        })
        .expect(201);

      expect(response.body.group.name).not.toContain('<script>');
    });

    it('should reject SQL injection', async () => {
      await request(app)
        .post('/api/groups')
        .set('Authorization', 'Bearer VALID_JWT')
        .send({
          name: "'; DROP TABLE users--",
        })
        .expect(400);
    });
  });

  describe('Security Headers', () => {
    it('should include CSP header', async () => {
      const response = await request(app)
        .get('/api/security/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should include security headers', async () => {
      const response = await request(app).get('/api/security/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });
});
```

Run integration tests:

```bash
npm run test:integration
```

---

## Manual Testing

### Test Transaction Decoder

#### 1. Start Backend

```bash
npm run dev
```

#### 2. Test Decoding Endpoint

```bash
# Decode a transaction
curl -X POST http://localhost:3001/api/decode-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "xdr": "YOUR_TRANSACTION_XDR",
    "origin": "https://app.stellar-save.com"
  }'
```

**Expected response:**
```json
{
  "decoded": {
    "operations": [...],
    "overallRiskLevel": "low",
    "warnings": [],
    "educationalPrompts": [...]
  },
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  },
  "originCheck": {
    "valid": true
  }
}
```

#### 3. Test High-Risk Transaction

```bash
curl -X POST http://localhost:3001/api/decode-transaction \
  -H "Content-Type: application/json" \
  -d '{
    "xdr": "LARGE_PAYMENT_XDR",
    "origin": "https://app.stellar-save.com"
  }'
```

**Expected:**
- `overallRiskLevel: "high"`
- Warnings about large amount
- Educational prompts

### Test Input Sanitization

#### 1. Test XSS Protection

```bash
curl -X POST http://localhost:3001/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "name": "<script>alert(\"xss\")</script>Test",
    "description": "Safe text"
  }'
```

**Expected:**
- Script tags encoded: `&lt;script&gt;`
- Group created successfully

#### 2. Test SQL Injection Protection

```bash
curl -X POST http://localhost:3001/api/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "name": "Test OR 1=1--"
  }'
```

**Expected:**
- 400 Bad Request
- Error: "Invalid input detected"

### Test Secrets Manager

#### 1. Check Secret Metadata

```bash
curl http://localhost:3001/api/admin/secrets/stellar-save%2Fjwt-secret/metadata
```

**Expected response:**
```json
{
  "metadata": {
    "name": "stellar-save/jwt-secret",
    "rotationEnabled": true,
    "rotationIntervalDays": 30,
    "lastRotated": "2024-01-15T10:30:00Z",
    "nextRotation": "2024-02-14T10:30:00Z"
  }
}
```

#### 2. Trigger Rotation

```bash
curl -X POST http://localhost:3001/api/admin/secrets/stellar-save%2Fjwt-secret/rotate
```

**Expected:**
- 200 OK
- Rotation initiated message
- CloudWatch logs show rotation steps

#### 3. Check Rotation Status

```bash
curl http://localhost:3001/api/admin/secrets/rotation-status
```

**Expected response:**
```json
{
  "status": {
    "upToDate": ["stellar-save/jwt-secret"],
    "needsRotation": [],
    "failed": []
  }
}
```

---

## CI/CD Testing

### OWASP ZAP Penetration Tests

#### 1. View Workflow

```bash
cat .github/workflows/penetration-testing.yml
```

#### 2. Trigger Manually

1. Go to GitHub Actions
2. Select "OWASP ZAP Penetration Testing"
3. Click "Run workflow"
4. Select branch
5. Click "Run workflow"

#### 3. Monitor Progress

Watch the workflow run:
- ✅ Backend starts successfully
- ✅ ZAP baseline scan completes
- ✅ ZAP full scan completes
- ✅ Authenticated API scan completes
- ✅ Severity gating applies
- ⚠️  Issues created for high findings

#### 4. Review Reports

1. Go to workflow run
2. Download "zap-reports" artifact
3. Extract and open HTML report
4. Review findings by severity

#### 5. Check Severity Gating

**Pass criteria:**
- High: 0 findings
- Medium: ≤5 findings
- Low: unlimited

**If failed:**
- GitHub Issue created automatically
- Build marked as failed
- Review required before merge

### Scheduled Scans

ZAP runs daily at 2 AM UTC:

```bash
# Check last scheduled run
gh run list --workflow=penetration-testing.yml --limit 5
```

### SLA Enforcement

Daily check for overdue security issues:

```bash
# Manually trigger SLA check
gh workflow run penetration-testing.yml \
  --ref main \
  -f job=remediation-sla-check
```

**SLA thresholds:**
- High: 24 hours
- Medium: 7 days
- Low: 30 days

---

## Production Validation

### Pre-Deployment Checklist

#### Transaction Decoder

- [ ] Known contracts configured in `KNOWN_CONTRACTS`
- [ ] CORS origins configured for production domains
- [ ] Educational prompts reviewed for clarity
- [ ] Risk thresholds appropriate for your use case

#### Input Sanitization

- [ ] Sanitization middleware applied to all routes
- [ ] Field-specific sanitization configured
- [ ] CSP policy customized for your frontend
- [ ] Security headers enabled

#### Penetration Testing

- [ ] ZAP workflow configured in CI/CD
- [ ] Severity thresholds set appropriately
- [ ] Alert notifications configured
- [ ] SLA monitoring enabled

#### Secrets Manager

- [ ] All secrets migrated to AWS Secrets Manager
- [ ] Rotation Lambda deployed
- [ ] Rotation schedules configured (30-90 days)
- [ ] CloudWatch alarms set up
- [ ] IAM roles and policies configured
- [ ] Cache TTL appropriate for your workload

### Deployment

#### 1. Deploy Backend

```bash
# Build
npm run build

# Deploy to staging
./deploy.sh staging

# Run smoke tests
npm run test:smoke -- --env=staging
```

#### 2. Validate Security Features

```bash
# Test transaction decoder
curl https://api-staging.stellar-save.com/api/decode-transaction \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"xdr": "TEST_XDR"}'

# Check security headers
curl -I https://api-staging.stellar-save.com/api/security/health

# Verify secrets manager
curl https://api-staging.stellar-save.com/api/admin/secrets/rotation-status
```

#### 3. Monitor

```bash
# Check logs
aws logs tail /aws/lambda/stellar-save-backend --follow

# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace "StellarSave/Security" \
  --metric-name "HighRiskTransactions" \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Post-Deployment Validation

#### Security Headers Check

```bash
# Verify CSP
curl -I https://api.stellar-save.com | grep -i content-security-policy

# Verify all security headers
curl -I https://api.stellar-save.com | grep -iE "x-frame-options|x-content-type-options|x-xss-protection"
```

#### Transaction Decoder Check

```bash
# Test with real transaction
curl https://api.stellar-save.com/api/decode-transaction \
  -X POST \
  -H "Content-Type: application/json" \
  -d @test-transaction.json
```

#### Secrets Rotation Check

```bash
# Verify rotation is working
aws secretsmanager describe-secret \
  --secret-id stellar-save/jwt-secret \
  --query 'RotationEnabled'

# Check last rotation
aws secretsmanager describe-secret \
  --secret-id stellar-save/jwt-secret \
  --query 'LastRotatedDate'
```

---

## Troubleshooting

### Transaction Decoder Issues

**Problem:** Transaction decoding fails

**Solution:**
1. Verify XDR format is correct
2. Check network passphrase matches
3. Review logs for specific error
4. Ensure Stellar SDK version is compatible

### Input Sanitization Issues

**Problem:** Legitimate input blocked

**Solution:**
1. Review sanitization patterns
2. Adjust `maxLength` limits if needed
3. Check if SQL pattern detection too aggressive
4. Whitelist specific patterns if necessary

### ZAP Scan Issues

**Problem:** Too many false positives

**Solution:**
1. Update `zap-config/rules.conf`
2. Add specific exclusions
3. Adjust scan intensity
4. Review and update thresholds

### Secrets Manager Issues

**Problem:** Cannot retrieve secrets

**Solution:**
1. Verify IAM permissions
2. Check secret name is correct
3. Ensure AWS region is correct
4. Verify secret exists in AWS console
5. Check CloudWatch logs for errors

**Problem:** Rotation fails

**Solution:**
1. Review Lambda logs
2. Check Lambda has required permissions
3. Verify service can accept new secret
4. Check test step passes
5. Review rotation configuration

---

## Performance Testing

### Load Test with Security Features

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt install k6  # Linux

# Run load test
k6 run backend/tests/load/security.test.js
```

**Expected performance:**
- Transaction decoding: <100ms p95
- Input sanitization: <10ms overhead
- Secret retrieval (cached): <1ms
- Secret retrieval (uncached): <50ms

---

## Continuous Monitoring

### Metrics to Track

1. **Transaction Decoder:**
   - Decode requests per minute
   - High-risk transaction percentage
   - Decode errors
   - Average decode time

2. **Input Sanitization:**
   - XSS attempts blocked
   - SQL injection attempts blocked
   - Sanitization errors
   - Processing time

3. **ZAP Scans:**
   - Vulnerabilities found (by severity)
   - Scan duration
   - False positive rate
   - SLA compliance

4. **Secrets Manager:**
   - Secret retrieval time
   - Cache hit rate
   - Rotation success rate
   - Failed rotations

### Alerts to Configure

1. High-risk transaction spike
2. Multiple XSS/SQL injection attempts from same IP
3. ZAP scan finds high-severity vulnerability
4. Secret rotation failure
5. Secrets Manager API errors

---

## Support

For testing issues or questions:
1. Review logs in `backend/logs/`
2. Check GitHub Actions for CI/CD runs
3. Review CloudWatch for AWS resources
4. Open issue with `testing` and `security` labels
