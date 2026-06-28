# Security Implementations

This document describes the security features implemented in issues #1102, #1103, #1104, and #1105.

## Table of Contents

1. [Transaction Signing Confirmation and Phishing Protection (#1102)](#1102)
2. [Input Sanitization and Output Encoding (#1103)](#1103)
3. [Automated Penetration Testing Pipeline (#1104)](#1104)
4. [Secrets Management with Rotation (#1105)](#1105)

---

## #1102: Transaction Signing Confirmation and Phishing Protection

### Overview

Protects users from signing malicious transactions by providing human-readable transaction decoding, phishing detection, and educational prompts.

### Components

#### Transaction Decoder Service

**Location:** `backend/src/transaction_decoder_service.ts`

**Features:**
- Converts Stellar/Soroban transaction XDR to human-readable format
- Identifies risky operations (large amounts, unrecognized addresses, contract calls)
- Provides risk assessment (low/medium/high)
- Educational prompts based on transaction type

**Usage:**

```typescript
import { transactionDecoderService } from './transaction_decoder_service';

// Decode a transaction
const decoded = transactionDecoderService.decodeTransaction(transactionXdr);

console.log(decoded.operations);        // Human-readable operations
console.log(decoded.overallRiskLevel);  // 'low' | 'medium' | 'high'
console.log(decoded.warnings);          // Security warnings
console.log(decoded.educationalPrompts); // User education
```

#### Validation

```typescript
// Validate transaction
const validation = transactionDecoderService.validateTransaction(
  transactionXdr,
  'https://app.stellar-save.com'
);

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
}

// Validate origin (phishing protection)
const originCheck = transactionDecoderService.validateOrigin(
  'https://suspicious-site.com'
);

if (!originCheck.valid) {
  console.warn('Possible phishing attempt:', originCheck.reason);
}
```

### Risk Levels

- **High Risk:**
  - Large transaction amounts (>10,000 XLM)
  - Account security modifications (setOptions)
  - Unrecognized smart contract calls
  
- **Medium Risk:**
  - Unusual amounts (>1,000 XLM)
  - Unrecognized addresses
  - Trustline modifications
  
- **Low Risk:**
  - Standard operations with known addresses
  - Small amounts

### Frontend Integration

```typescript
// Frontend usage example
async function signTransaction(xdr: string, origin: string) {
  // Decode transaction
  const decoded = await fetch('/api/decode-transaction', {
    method: 'POST',
    body: JSON.stringify({ xdr, origin }),
  }).then(r => r.json());
  
  // Show user-friendly information
  showTransactionDetails(decoded);
  
  // Display warnings
  if (decoded.warnings.length > 0) {
    showWarnings(decoded.warnings);
  }
  
  // Show educational prompts
  showEducationalContent(decoded.educationalPrompts);
  
  // Get user confirmation
  const confirmed = await getUserConfirmation();
  
  if (confirmed) {
    // Sign transaction
    await wallet.signTransaction(xdr);
  }
}
```

### Configuration

Add known contract addresses to `KNOWN_CONTRACTS` in `transaction_decoder_service.ts`:

```typescript
const KNOWN_CONTRACTS: Record<string, { name: string; trusted: boolean }> = {
  'CXXXXXXXXX...': { name: 'Stellar Save Contract', trusted: true },
  'CYYYYYYYYYY...': { name: 'Partner Contract', trusted: true },
};
```

---

## #1103: Input Sanitization and Output Encoding

### Overview

Comprehensive input sanitization to prevent XSS, SQL injection, and other injection attacks.

### Components

#### Input Sanitization Middleware

**Location:** `backend/src/input_sanitization_middleware.ts`

**Features:**
- HTML entity encoding
- XSS pattern detection
- SQL injection prevention
- Recursive object sanitization
- Field-specific validation

#### Security Headers Middleware

**Location:** `backend/src/security_headers_middleware.ts`

**Features:**
- Content Security Policy (CSP)
- XSS Protection headers
- Clickjacking prevention
- MIME type sniffing prevention
- HSTS for production

### Usage

#### Global Sanitization

```typescript
import { sanitizeInputMiddleware } from './input_sanitization_middleware';

// Apply to all routes
app.use(sanitizeInputMiddleware);
```

#### Field-Specific Sanitization

```typescript
import {
  sanitizeGroupMetadataMiddleware,
  sanitizeProfileMiddleware,
  InputSanitizer,
} from './input_sanitization_middleware';

// Group metadata
router.post('/groups',
  sanitizeGroupMetadataMiddleware,
  createGroupHandler
);

// User profiles
router.put('/profile',
  sanitizeProfileMiddleware,
  updateProfileHandler
);

// Manual sanitization
const safeComment = InputSanitizer.sanitizeComment(userComment);
```

#### Security Headers

```typescript
import { securityHeadersMiddleware } from './security_headers_middleware';

// Apply security headers globally
app.use(securityHeadersMiddleware);
```

### CSP Configuration

Default CSP policy:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
img-src 'self' data: https:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://soroban-testnet.stellar.org;
frame-src 'none';
object-src 'none';
```

Customize for your needs:

```typescript
import { createSecurityHeadersMiddleware } from './security_headers_middleware';

const customHeaders = createSecurityHeadersMiddleware({
  'script-src': ["'self'", 'https://trusted-cdn.com'],
  'connect-src': ["'self'", 'https://api.stellar.org'],
});

app.use(customHeaders);
```

### Validation Helpers

```typescript
// Stellar address
if (!InputSanitizer.validateStellarAddress(address)) {
  throw new Error('Invalid Stellar address');
}

// Email
if (!InputSanitizer.validateEmail(email)) {
  throw new Error('Invalid email format');
}

// URL
try {
  const safeUrl = InputSanitizer.sanitizeUrl(userUrl);
} catch (error) {
  console.error('Invalid URL');
}
```

### Testing

Run sanitization tests:

```bash
npm test -- input-sanitization.test.ts
```

Tests cover:
- XSS prevention (script tags, event handlers, javascript: protocol)
- SQL injection detection
- Group metadata sanitization
- Profile data sanitization
- Comment sanitization
- HTML encoding/decoding

---

## #1104: Automated Penetration Testing Pipeline

### Overview

OWASP ZAP integration for automated Dynamic Application Security Testing (DAST) in CI/CD.

### Configuration

**Location:** `.github/workflows/penetration-testing.yml`

**Features:**
- Baseline and full ZAP scans
- Authenticated API scanning
- Severity-based gating
- Automatic issue creation for high-severity findings
- SLA tracking and enforcement

### Workflow Triggers

- Push to `main` or `develop` branches
- Pull requests
- Daily scheduled scan (2 AM UTC)
- Manual trigger via GitHub Actions UI

### Scan Types

#### 1. Baseline Scan

Quick passive scan for common vulnerabilities.

```yaml
- name: Run OWASP ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.10.0
  with:
    target: ${{ env.TARGET_URL }}
```

#### 2. Full Scan

Comprehensive active scan including:
- Spider/crawl
- Active vulnerability scanning
- Authentication testing

#### 3. Authenticated API Scan

Tests protected endpoints with JWT authentication:

```yaml
- name: Run authenticated API scan
  run: |
    docker run --network host --rm \
      -v $(pwd)/zap-config:/zap/wrk/:rw \
      -t owasp/zap2docker-stable \
      zap-api-scan.py \
      -t http://localhost:3001/api
```

### Severity Gating

**Thresholds:**
- **High severity:** 0 allowed (fails build)
- **Medium severity:** 5 allowed (warning)
- **Low severity:** No limit

Customize in workflow:

```yaml
# Define thresholds
HIGH_THRESHOLD=0
MEDIUM_THRESHOLD=5
```

### Remediation SLAs

| Severity | SLA       | Label            |
|----------|-----------|------------------|
| High     | 24 hours  | high-priority    |
| Medium   | 7 days    | medium-priority  |
| Low      | 30 days   | low-priority     |

### Reports

ZAP generates reports in multiple formats:
- HTML (visual report)
- Markdown (GitHub-friendly)
- JSON (machine-readable)

Access reports:
1. Go to GitHub Actions run
2. Download "zap-reports" artifact
3. Review findings

### Issue Management

High-severity findings automatically create GitHub issues:

```yaml
- name: Create security issue for high findings
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        title: `[SECURITY] ZAP Scan found ${high} high severity vulnerabilities`,
        labels: ['security', 'vulnerability', 'high-priority']
      });
```

### Local Testing

Run ZAP locally:

```bash
# Start backend
cd backend
npm start

# Run ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://host.docker.internal:3001 \
  -r zap-report.html

# Run full scan
docker run -t owasp/zap2docker-stable zap-full-scan.py \
  -t http://host.docker.internal:3001
```

### Customization

#### Add Scanning Rules

Edit `zap-config/rules.conf`:

```conf
# Increase scan intensity for critical endpoints
10000=HIGH  # SQL Injection
10001=HIGH  # XSS
10002=HIGH  # Path Traversal
```

#### Configure Context

Edit `zap-config/context.xml` to define:
- In-scope URLs
- Technology stack
- Authentication settings

---

## #1105: Secrets Management with Rotation

### Overview

AWS Secrets Manager integration for centralized secret management with automatic rotation.

### Components

#### Secrets Manager Service

**Location:** `backend/src/secrets_manager_service.ts`

**Features:**
- AWS Secrets Manager integration
- Secret caching (5-minute TTL)
- Automatic rotation support
- Batch operations
- Rotation status monitoring

#### Rotation Lambda

**Location:** `backend/src/secrets_rotation_lambda.ts`

AWS Lambda function for automatic secret rotation following the 4-step process:
1. **createSecret** - Generate new secret value
2. **setSecret** - Update service with new secret
3. **testSecret** - Verify new secret works
4. **finishSecret** - Mark rotation complete

### Setup

#### 1. Create Secrets in AWS

```bash
# JWT Secret
aws secretsmanager create-secret \
  --name stellar-save/jwt-secret \
  --description "JWT signing secret" \
  --secret-string "$(openssl rand -hex 64)"

# Admin Secret
aws secretsmanager create-secret \
  --name stellar-save/admin-secret \
  --description "Admin API secret" \
  --secret-string "$(openssl rand -hex 32)"

# Database Password
aws secretsmanager create-secret \
  --name stellar-save/db-password \
  --description "PostgreSQL password" \
  --secret-string "$(openssl rand -base64 32)"
```

#### 2. Deploy Rotation Lambda

```bash
# Package Lambda
cd backend/src
zip -r rotation-lambda.zip secrets_rotation_lambda.ts node_modules/

# Deploy
aws lambda create-function \
  --function-name stellar-save-secret-rotation \
  --runtime nodejs20.x \
  --handler secrets_rotation_lambda.handler \
  --zip-file fileb://rotation-lambda.zip \
  --role arn:aws:iam::ACCOUNT:role/lambda-secrets-rotation
```

#### 3. Configure Rotation

```typescript
import { secretsManager } from './secrets_manager_service';

// Enable 30-day rotation
await secretsManager.enableRotation('stellar-save/jwt-secret', {
  automaticallyAfterDays: 30,
  lambdaArn: 'arn:aws:lambda:REGION:ACCOUNT:function:stellar-save-secret-rotation',
});
```

### Usage

#### Retrieve Secrets

```typescript
import { secretsManager } from './secrets_manager_service';

// Single secret (cached)
const jwtSecret = await secretsManager.getSecret('stellar-save/jwt-secret');
console.log(jwtSecret.value);

// Multiple secrets
const secrets = await secretsManager.getSecrets([
  'stellar-save/jwt-secret',
  'stellar-save/admin-secret',
  'stellar-save/db-password',
]);
```

#### Update Secrets

```typescript
// Update secret value
await secretsManager.updateSecret(
  'stellar-save/api-key',
  'new-secret-value'
);

// Trigger rotation manually
await secretsManager.rotateSecret('stellar-save/jwt-secret');
```

#### Application Startup

```typescript
import { initializeSecrets } from './secrets_manager_service';

async function startServer() {
  // Load secrets from AWS
  await initializeSecrets();
  
  // Now process.env contains secrets from AWS
  const jwtSecret = process.env.JWT_SECRET;
  
  app.listen(3001);
}
```

### Monitoring

#### Check Rotation Status

```typescript
const secretNames = [
  'stellar-save/jwt-secret',
  'stellar-save/admin-secret',
  'stellar-save/db-password',
];

const status = await secretsManager.checkRotationStatus(secretNames);

console.log('Up to date:', status.upToDate);
console.log('Needs rotation:', status.needsRotation);
console.log('Failed:', status.failed);
```

#### Rotation Failure Alerts

The rotation Lambda automatically logs failures. Configure CloudWatch Alarms:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name stellar-save-rotation-failure \
  --alarm-description "Alert on secret rotation failure" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=stellar-save-secret-rotation
```

### Migration from Environment Variables

```typescript
import { migrateSecretToAWS } from './secrets_manager_service';

// Migrate existing secrets
await migrateSecretToAWS(
  'stellar-save/jwt-secret',
  process.env.JWT_SECRET!,
  'JWT signing secret for authentication'
);
```

### Security Best Practices

1. **Remove hardcoded secrets** from `.env` files after migration
2. **Enable rotation** for all secrets (recommended: 30-90 days)
3. **Monitor rotation status** in production
4. **Use IAM roles** instead of access keys when possible
5. **Tag secrets** for cost tracking and auditing
6. **Cache secrets** to reduce API calls and costs
7. **Clear cache** after rotation or updates

### IAM Permissions

Required IAM policy for the application:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:stellar-save/*"
    }
  ]
}
```

Required for rotation Lambda:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecretVersionStage",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:stellar-save/*"
    }
  ]
}
```

### Testing

```bash
# Run secrets manager tests
npm test -- secrets-manager.test.ts

# Test rotation locally (with LocalStack)
docker-compose -f docker-compose.test.yml up
npm run test:secrets-rotation
```

---

## Security Checklist

- [ ] Deploy transaction decoder service to production
- [ ] Add known contract addresses to whitelist
- [ ] Enable input sanitization middleware on all routes
- [ ] Configure CSP headers for your domain
- [ ] Set up OWASP ZAP workflow in CI/CD
- [ ] Review and adjust severity thresholds
- [ ] Create AWS Secrets Manager secrets
- [ ] Deploy rotation Lambda function
- [ ] Enable automatic rotation (30-90 days)
- [ ] Migrate secrets from .env files
- [ ] Remove hardcoded secrets from repository
- [ ] Set up CloudWatch alerts for rotation failures
- [ ] Configure IAM roles and policies
- [ ] Test all security features in staging
- [ ] Train team on new security workflows

---

## Support

For issues or questions:
1. Check test files for usage examples
2. Review inline code documentation
3. Open a GitHub issue with the `security` label
4. Contact the security team

## Related Documentation

- [SECURITY.md](../SECURITY.md) - Security policy
- [TESTING.md](../TESTING.md) - Testing guide
- [.github/workflows/penetration-testing.yml](../.github/workflows/penetration-testing.yml) - ZAP configuration
