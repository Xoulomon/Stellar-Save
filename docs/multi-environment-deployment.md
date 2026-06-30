# Multi-Environment Deployment Strategy

## Overview

Stellar-Save uses a multi-environment deployment architecture to ensure stability, testing, and controlled rollouts. This document outlines the strategy for managing three distinct deployment environments:
- **Development (Dev)**: For experimental changes and rapid testing
- **Staging**: For pre-production testing and validation
- **Production**: For live user access

## Environment Tiers

### Development (Dev)
- **Network**: Testnet
- **Frontend URL**: https://dev.stellar-save.app
- **Purpose**: Rapid iteration and testing new features
- **Deployment**: Continuous from feature branches
- **Retention**: 7 days
- **Auto-deploy**: ✓ Enabled

### Staging
- **Network**: Testnet
- **Frontend URL**: https://staging.stellar-save.app
- **Purpose**: Pre-production validation and QA
- **Deployment**: Triggered from develop branch promotions
- **Retention**: 30 days
- **Auto-deploy**: ✓ Enabled

### Production
- **Network**: Mainnet
- **Frontend URL**: https://stellar-save.app
- **Purpose**: Live user-facing application
- **Deployment**: Manual approval from main branch
- **Retention**: 90 days
- **Auto-deploy**: ✗ Disabled (requires approval)

## Deployment Workflow

### Configuration Flow

```
Code Push
    ↓
[configure-environment] (Determine target environment)
    ↓
[build] (Build frontend & contracts)
    ↓
[deploy-*] (Deploy to specific environment)
    ↓
[health-check] (Verify deployment)
```

### Branch-to-Environment Mapping

| Branch | Environment | Network | Trigger |
|--------|-------------|---------|---------|
| feature/* | dev | testnet | Push to PR |
| develop | staging | testnet | Merge to dev |
| main | production | mainnet | Manual approval |

## Promotion Workflow

### Valid Promotion Paths

```
Dev → Staging → Production
```

### Promotion Process

1. **Identify candidate**: Select version from source environment
2. **Validate**: Run tests and verify health checks
3. **Promote**: Execute promotion workflow
4. **Verify**: Run health checks in target environment
5. **Record**: Document promotion with timestamps

### Manual Promotion

Trigger promotion workflow with parameters:
```yaml
promotion_from: staging
environment: production
```

## Configuration Management

### Environment Variables

Each environment defines specific configuration:

```yaml
dev:
  network: testnet
  rpc_url: https://soroban-testnet.stellar.org
  frontend_url: https://dev.stellar-save.app
  api_base: https://api-dev.stellar-save.app
  auto_deploy: true

staging:
  network: testnet
  rpc_url: https://soroban-testnet.stellar.org
  frontend_url: https://staging.stellar-save.app
  api_base: https://api-staging.stellar-save.app
  auto_deploy: true

production:
  network: mainnet
  rpc_url: https://soroban-rpc.mainnet.stellar.gateway.fm
  frontend_url: https://stellar-save.app
  api_base: https://api.stellar-save.app
  auto_deploy: false
```

### Loading Environment Configuration

```bash
# Load specific environment config
source scripts/env-config.sh
./scripts/env-config.sh set staging

# Print configuration
./scripts/env-config.sh config production

# List available environments
./scripts/env-config.sh list
```

## Deployment Artifacts

### Build Artifacts

Each environment deployment produces:

1. **Frontend Build**
   - Optimized JavaScript/CSS bundles
   - Environment-specific configuration
   - Static assets

2. **Contract Build**
   - Compiled WASM binaries
   - Release optimized
   - Network-specific settings

3. **Deployment Info**
   - Build timestamp
   - Commit SHA
   - Environment metadata

### Artifact Retention

- **Dev**: 7 days
- **Staging**: 30 days
- **Production**: 90 days

## Health Checks

### Pre-Deployment Checks

- [ ] Code quality passes
- [ ] All tests pass
- [ ] No security vulnerabilities
- [ ] Performance within thresholds
- [ ] Dependencies up to date

### Post-Deployment Checks

1. **Frontend Health**
   - HTTP endpoint responds (200)
   - Assets load correctly
   - API connectivity verified

2. **Contract Health**
   - Contract deployed successfully
   - RPC endpoint accessible
   - State verified

3. **Integration Tests**
   - Smoke tests pass
   - Critical workflows functional
   - External dependencies available

## Rollback Procedures

### Dev Environment
- Automatic rollback if deployment fails
- No data loss (development only)

### Staging Environment
- Manual rollback via GitHub Actions
- Preserve test data if possible
- Notify team of rollback

### Production Environment
- Manual approval required
- Data migration planning
- Customer communication

## Time-based Deployment Rules

### Restricted Deployment Windows

| Environment | Deployment Window | Reason |
|-------------|-------------------|--------|
| dev | Always open | Development only |
| staging | Always open | Pre-production testing |
| production | Mon-Thu 9am-5pm UTC | Minimize user impact |

### Promotion Delays

- **Dev → Staging**: 24 hours minimum (allow testing)
- **Staging → Production**: 48 hours minimum (beta testing)

## Deployment Comparison

### Environment Feature Matrix

| Feature | Dev | Staging | Production |
|---------|-----|---------|-----------|
| Auto-deploy on commit | ✓ | ✓ | ✗ |
| Automated testing | ✓ | ✓ | ✓ |
| Smoke tests | ✓ | ✓ | ✓ |
| Manual approval gate | ✗ | ✗ | ✓ |
| Production environment | ✗ | testnet | mainnet |
| Data persistence | Limited | 30 days | Live |
| SLA | N/A | N/A | 99.9% |

## Monitoring & Alerting

### Deployment Monitoring

- Real-time deployment status in GitHub Actions
- Email notifications on deployment completion
- Slack integration for team alerts
- Deployment dashboard

### Environment Monitoring

- Uptime monitoring for each environment
- Performance metrics tracking
- Error rate monitoring
- Resource utilization alerts

## Deployment Commands

### Set Environment Variables

```bash
./scripts/env-config.sh set dev       # Set dev environment
./scripts/env-config.sh set staging   # Set staging environment
./scripts/env-config.sh set production # Set production environment
```

### Print Configuration

```bash
./scripts/env-config.sh config dev
./scripts/env-config.sh config staging
./scripts/env-config.sh config production
```

### Trigger Manual Deployment

```bash
# Via GitHub CLI
gh workflow run multi-environment-deployment.yml \
  -f environment=staging \
  -f promotion_from=dev
```

## Testing Multi-Environment Deployments

### Run Deployment Tests

```bash
bash scripts/test-multi-environment-deployment.sh
```

### Manual Testing Checklist

- [ ] Dev deployment completes
- [ ] Staging deployment from develop branch
- [ ] Production deployment requires approval
- [ ] Health checks pass for each environment
- [ ] Environment-specific configs load correctly
- [ ] Rollback procedure functions properly

## Troubleshooting

### Common Issues

**Deployment fails in staging**
- Check environment configuration
- Verify dependencies deployed
- Review error logs in GitHub Actions
- Test locally before retrying

**Production deployment blocked**
- Verify manual approval is pending
- Check for required status checks
- Ensure production environment exists
- Review deployment restrictions

**Health checks failing**
- Run health check manually
- Check network connectivity
- Verify endpoint accessibility
- Review error logs

### Debug Commands

```bash
# Check environment setup
./scripts/env-config.sh list
./scripts/env-config.sh config production

# View deployment logs
gh run view <run-id>

# Download artifacts
gh run download <run-id>
```

## Best Practices

1. **Always test in staging before production**
2. **Use promotion workflow for prod deployments**
3. **Review deployment reports after each rollout**
4. **Monitor health checks during deployment**
5. **Keep environment configs documented**
6. **Maintain 24-48 hour staging beta window**
7. **Document all manual deployments**
8. **Archive deployment artifacts for audit**

## Future Enhancements

- [ ] Canary deployments (10% → 50% → 100%)
- [ ] Blue-green deployments
- [ ] Automated performance testing
- [ ] Environment-specific feature flags
- [ ] Cost monitoring per environment
- [ ] Database migration automation
- [ ] Custom deployment schedules
