# Performance Benchmarking Pipeline

## Overview

This document describes the automated performance benchmarking pipeline for Stellar-Save, which tracks:
- **Contract Gas Costs**: Monitor Soroban contract function gas usage to detect regressions
- **Frontend Performance**: Track web vital metrics and Lighthouse scores
- **Performance Trends**: Analyze trends over time to identify performance degradation

## Gas Cost Benchmarking

### Tracked Functions

| Function | Threshold | Priority |
|----------|-----------|----------|
| `create_group` | 2M gas | Normal |
| `contribution` | 1.5M gas | Normal |
| `auto_advance_cycle` | 3M gas | Critical |
| `distribute_winnings` | 4M gas | Critical |
| `apply_penalty` | 800K gas | Normal |
| `query_group_status` | 500K gas | Normal |

### Gas Budget Management

- **Development**: Unlimited budgets for exploration
- **Testing**: Focused budgets on specific operations
- **Production**: Strict limits with regression alerts at +10% threshold

### Running Gas Benchmarks Locally

```bash
# Run all benchmarks
cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark -- --nocapture

# Run specific benchmark
cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark_create_group_gas -- --nocapture

# With detailed output
RUST_BACKTRACE=1 cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark -- --nocapture --test-threads=1
```

## Frontend Performance Metrics

### Lighthouse Targets

| Category | Target Score | Min Score |
|----------|---------------|-----------|
| Performance | 90 | 85 |
| Accessibility | 95 | 90 |
| Best Practices | 90 | 85 |
| SEO | 95 | 90 |

### Web Vitals Targets

| Metric | Target | Warning |
|--------|--------|---------|
| First Contentful Paint (FCP) | 1.8s | 2.5s |
| Largest Contentful Paint (LCP) | 2.5s | 4.0s |
| Cumulative Layout Shift (CLS) | 0.1 | 0.25 |
| First Input Delay (FID) | 100ms | 300ms |
| Interaction to Next Paint (INP) | 200ms | 500ms |

### Running Frontend Performance Tests Locally

```bash
# Build for production
cd frontend
npm run build

# Start preview server
npm run preview -- --host 127.0.0.1 --port 4173

# In another terminal, run Lighthouse
npx lhci autorun --config .lighthouserc-perf.json
```

## Performance Regression Detection

### Automated Alerts

The pipeline automatically detects:

1. **Gas Regressions**: When gas usage increases >10% above baseline
2. **Lighthouse Regressions**: When scores decrease >5 points
3. **Web Vital Regressions**: When metrics exceed warning thresholds

### Response Actions

- **PR Comments**: Performance results posted to pull requests
- **Build Artifacts**: Detailed reports available in GitHub Actions
- **Failure Status**: Build marked as failed if critical regressions detected

## Performance Workflow

### On Pull Request

1. Run comprehensive benchmarks
2. Compare against base branch
3. Flag regressions (if any)
4. Post summary to PR

### On Merge to Main

1. Run benchmarks with extended runs (3x Lighthouse audits)
2. Archive results for historical tracking
3. Update performance dashboard

### Weekly Scheduled

1. Full regression analysis
2. Generate trend reports
3. Identify performance drift

## Performance Dashboard

The performance dashboard (`performance-results/dashboard.html`) displays:

- **Current Metrics**: Latest benchmark results
- **Trends**: Historical performance data
- **Alerts**: Active regressions or issues
- **Comparisons**: Branch-to-branch analysis

Access via GitHub Actions artifacts after workflow completion.

## Performance Optimization Guide

### Contract Optimization

If gas costs exceed thresholds:

1. **Profile** the operation with `cargo llvm-cov`
2. **Identify** hotspots in contract logic
3. **Optimize** by:
   - Reducing state reads/writes
   - Batching operations
   - Using more efficient algorithms
4. **Verify** with benchmarks

### Frontend Optimization

If Lighthouse scores are low:

1. **Check** which audits are failing
2. **Optimize by**:
   - Reducing bundle size
   - Code splitting routes
   - Image optimization
   - Lazy loading non-critical components
3. **Verify** with local Lighthouse audits

## Configuration

Performance thresholds and settings are defined in:

- `docs/performance-config.json`: Threshold configurations
- `.github/workflows/performance-benchmarks.yml`: Workflow definition
- `frontend/lighthouse-config.js`: Lighthouse audit settings

## Troubleshooting

### Benchmark Flakiness

If benchmarks show inconsistent results:

1. Reduce background processes during runs
2. Increase number of runs (Lighthouse defaults to 3)
3. Check for environment differences
4. Review CI machine specifications

### Gas Estimation Accuracy

Gas estimates can vary due to:
- Network state variations
- Test environment differences
- Soroban version updates

Monitor trends rather than absolute values.

### Lighthouse Score Fluctuations

Common causes:
- Network throttling variations
- JavaScript execution timing
- Resource loading order
- System load during CI runs

Review multiple runs for trends.

## Future Improvements

- [ ] Comparative reporting across teams/branches
- [ ] Automated optimization recommendations
- [ ] Contract storage analysis
- [ ] Memory usage tracking
- [ ] Custom metrics integration
- [ ] Historical data persistence
