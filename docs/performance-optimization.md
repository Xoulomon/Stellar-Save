# Performance Optimization Guide

## Overview

This guide covers performance optimization techniques for Stellar-Save users and developers. It includes gas optimization strategies, frontend performance tips, caching best practices, monitoring guidance, and benchmarking instructions.

## Table of Contents

1. [Gas Optimization Strategies](#gas-optimization-strategies)
2. [Frontend Performance Tips](#frontend-performance-tips)
3. [Caching Best Practices](#caching-best-practices)
4. [Performance Monitoring](#performance-monitoring)
5. [Benchmarking Instructions](#benchmarking-instructions)

---

## Gas Optimization Strategies

### Contract-Level Optimizations

#### 1. Minimize Storage Operations

Storage reads and writes are the most expensive operations in Soroban contracts.

**Best Practices:**
- Batch storage operations when possible
- Cache frequently accessed values in memory
- Use bitmap-based tracking for large member sets (see [storage-optimization.md](storage-optimization.md))
- Avoid redundant storage reads within the same function

**Example:**
```rust
// ❌ Bad: Multiple reads
let group = storage.get(&group_key)?;
let member = storage.get(&member_key)?;
let status = storage.get(&status_key)?;

// ✅ Good: Single read with structured data
let group_data = storage.get(&group_key)?;
// Access all needed fields from group_data
```

#### 2. Optimize Data Structures

**Use compact types:**
- `u32` instead of `u64` when range allows
- `Symbol` instead of `String` for fixed identifiers
- Bit-packed flags instead of multiple boolean fields

**Example:**
```rust
// ❌ Bad: Multiple storage entries
storage.set(&key_active, true);
storage.set(&key_eligible, true);
storage.set(&key_contributed, false);

// ✅ Good: Single bit-packed field
let flags: u32 = 0b0000_0011; // active=1, eligible=1, contributed=0
storage.set(&key_flags, flags);
```

#### 3. Reduce Function Complexity

**Strategies:**
- Break complex operations into smaller functions
- Avoid deep nesting and loops
- Use early returns to skip unnecessary computation
- Minimize cross-contract calls

**Gas Cost Targets:**

| Function | Target Gas | Critical |
|----------|-----------|----------|
| `create_group` | < 2M | No |
| `contribute` | < 1.5M | No |
| `auto_advance_cycle` | < 3M | Yes |
| `distribute_winnings` | < 4M | Yes |
| `query_group_status` | < 500K | No |

#### 4. Optimize Loops

**Best Practices:**
- Limit loop iterations (enforce max members)
- Use bitmap operations instead of iterating members
- Cache loop-invariant values outside loops
- Consider pagination for large datasets

**Example:**
```rust
// ❌ Bad: Iterate all members
for member in members.iter() {
    if storage.get(&contrib_key(member))? {
        count += 1;
    }
}

// ✅ Good: Use bitmap
let bitmap = storage.get(&bitmap_key)?;
let count = bitmap.contributors_count; // O(1) cached value
```

#### 5. Contract Size Optimization

Smaller contracts load faster and cost less to deploy. See [size-optimization.md](size-optimization.md) for details.

**Key techniques:**
- Use `opt-level = "z"` in release profile
- Enable LTO (link-time optimization)
- Strip debug symbols
- Run `wasm-opt -Oz` post-build
- Avoid unnecessary dependencies

### User-Level Gas Optimization

#### For Group Creators

**Choose optimal parameters:**
- Smaller groups (< 100 members) have lower gas costs
- Longer cycle durations reduce transaction frequency
- Consider gas costs when setting contribution amounts

**Estimated gas costs:**
- Creating a group: ~2M gas
- Each member joining: ~500K gas
- Each contribution: ~1.5M gas
- Payout distribution: ~4M gas

#### For Group Members

**Timing strategies:**
- Contribute early in the cycle to avoid rush
- Batch operations when possible
- Monitor network congestion and gas prices

---

## Frontend Performance Tips

### Build Optimization

#### 1. Code Splitting

Split your application into smaller chunks that load on demand.

**Vite configuration:**
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'stellar': ['@stellar/stellar-sdk', '@stellar/freighter-api'],
          'ui': ['@mui/material', '@mui/icons-material']
        }
      }
    }
  }
}
```

#### 2. Tree Shaking

Remove unused code from bundles.

**Best practices:**
- Use ES6 imports (`import { specific } from 'lib'`)
- Avoid `import *` patterns
- Configure `sideEffects: false` in package.json
- Use production builds for deployment

#### 3. Asset Optimization

**Images:**
- Use WebP format with fallbacks
- Implement lazy loading for below-fold images
- Serve responsive images with `srcset`
- Compress images (target < 100KB per image)

**Fonts:**
- Use `font-display: swap` to prevent blocking
- Subset fonts to include only needed characters
- Preload critical fonts

**Example:**
```html
<link rel="preload" href="/fonts/roboto.woff2" as="font" type="font/woff2" crossorigin>
```

### Runtime Optimization

#### 1. React Performance

**Memoization:**
```javascript
// Memoize expensive computations
const sortedGroups = useMemo(() => 
  groups.sort((a, b) => b.created_at - a.created_at),
  [groups]
);

// Memoize callbacks
const handleContribute = useCallback((groupId) => {
  contribute(groupId, amount);
}, [amount]);

// Memoize components
const GroupCard = memo(({ group }) => {
  return <div>{group.name}</div>;
});
```

**Virtualization:**
```javascript
// Use react-window for long lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={groups.length}
  itemSize={120}
>
  {({ index, style }) => (
    <div style={style}>
      <GroupCard group={groups[index]} />
    </div>
  )}
</FixedSizeList>
```

#### 2. State Management

**React Query optimization:**
```javascript
// Configure stale time and cache time
const { data: groups } = useQuery({
  queryKey: ['groups'],
  queryFn: fetchGroups,
  staleTime: 30000,      // 30 seconds
  cacheTime: 300000,     // 5 minutes
  refetchOnWindowFocus: false
});

// Prefetch data
queryClient.prefetchQuery({
  queryKey: ['group', groupId],
  queryFn: () => fetchGroup(groupId)
});
```

#### 3. Network Optimization

**Request batching:**
```javascript
// Batch multiple contract calls
const results = await Promise.all([
  contract.get_group(groupId1),
  contract.get_group(groupId2),
  contract.get_group(groupId3)
]);
```

**Request prioritization:**
```javascript
// Critical data first
const criticalData = await fetchUserGroups();
// Non-critical data later
setTimeout(() => fetchGroupHistory(), 100);
```

### Web Vitals Targets

| Metric | Target | Warning |
|--------|--------|---------|
| First Contentful Paint (FCP) | < 1.8s | < 2.5s |
| Largest Contentful Paint (LCP) | < 2.5s | < 4.0s |
| Cumulative Layout Shift (CLS) | < 0.1 | < 0.25 |
| First Input Delay (FID) | < 100ms | < 300ms |
| Interaction to Next Paint (INP) | < 200ms | < 500ms |

---

## Caching Best Practices

### Contract Data Caching

#### 1. Client-Side Caching

**React Query configuration:**
```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,           // Data fresh for 30s
      cacheTime: 300000,          // Keep in cache for 5min
      retry: 2,                   // Retry failed requests
      refetchOnMount: false,      // Don't refetch on component mount
      refetchOnWindowFocus: false // Don't refetch on window focus
    }
  }
});
```

**Cache invalidation:**
```javascript
// Invalidate after mutation
const mutation = useMutation({
  mutationFn: contributeToGroup,
  onSuccess: () => {
    queryClient.invalidateQueries(['groups']);
    queryClient.invalidateQueries(['group', groupId]);
  }
});
```

#### 2. Browser Storage

**LocalStorage for persistent data:**
```javascript
// Cache user preferences
const cacheUserPreferences = (prefs) => {
  localStorage.setItem('user_prefs', JSON.stringify(prefs));
};

// Cache with expiration
const cacheWithExpiry = (key, data, ttl) => {
  const item = {
    value: data,
    expiry: Date.now() + ttl
  };
  localStorage.setItem(key, JSON.stringify(item));
};
```

**SessionStorage for temporary data:**
```javascript
// Cache for current session only
sessionStorage.setItem('temp_group_data', JSON.stringify(groupData));
```

#### 3. Service Worker Caching

**Cache static assets:**
```javascript
// service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('stellar-save-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/app.js'
      ]);
    })
  );
});
```

### API Response Caching

#### 1. Horizon API Caching

**Cache transaction history:**
```javascript
const fetchTransactionHistory = async (address) => {
  const cacheKey = `tx_history_${address}`;
  const cached = sessionStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 60000) { // 1 minute
      return data;
    }
  }
  
  const data = await horizonServer.transactions()
    .forAccount(address)
    .limit(50)
    .call();
  
  sessionStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  
  return data;
};
```

#### 2. RPC Response Caching

**Cache contract state:**
```javascript
const cachedContractCall = async (contractId, method, params) => {
  const cacheKey = `${contractId}_${method}_${JSON.stringify(params)}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30000) {
    return cached.data;
  }
  
  // Make RPC call
  const data = await contract[method](...params);
  
  // Update cache
  cache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
};
```

### Cache Invalidation Strategies

**Time-based:**
```javascript
// Invalidate after fixed duration
const TTL = {
  GROUP_DATA: 30000,      // 30 seconds
  USER_PROFILE: 300000,   // 5 minutes
  STATIC_DATA: 3600000    // 1 hour
};
```

**Event-based:**
```javascript
// Invalidate on Soroban events
contract.on('ContributionMade', (event) => {
  queryClient.invalidateQueries(['group', event.group_id]);
});

contract.on('PayoutExecuted', (event) => {
  queryClient.invalidateQueries(['group', event.group_id]);
  queryClient.invalidateQueries(['member', event.recipient]);
});
```

**Manual invalidation:**
```javascript
// User-triggered refresh
const handleRefresh = () => {
  queryClient.invalidateQueries();
  toast.success('Data refreshed');
};
```

---

## Performance Monitoring

### Contract Performance Monitoring

#### 1. Gas Usage Tracking

**Monitor gas consumption:**
```rust
// In tests
#[test]
fn test_contribute_gas() {
    let env = Env::default();
    env.budget().reset_unlimited();
    
    // Execute operation
    contract.contribute(&group_id, &member, &amount);
    
    // Check gas usage
    let gas_used = env.budget().cpu_instruction_cost();
    assert!(gas_used < 1_500_000, "Gas usage too high: {}", gas_used);
}
```

**Log gas metrics:**
```rust
// Production monitoring
log!(&env, "contribute gas: {}", env.budget().cpu_instruction_cost());
```

#### 2. Storage Cost Tracking

**Monitor storage growth:**
```rust
pub fn get_storage_stats(env: &Env, group_id: u64) -> StorageStats {
    StorageStats {
        total_entries: count_storage_entries(env, group_id),
        total_bytes: estimate_storage_bytes(env, group_id),
        cost_estimate: calculate_storage_cost(env, group_id)
    }
}
```

### Frontend Performance Monitoring

#### 1. Web Vitals Monitoring

**Implement monitoring:**
```javascript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

const sendToAnalytics = (metric) => {
  // Send to your analytics service
  console.log(metric);
};

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

#### 2. Custom Performance Metrics

**Track contract call duration:**
```javascript
const measureContractCall = async (operation, fn) => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    // Log metric
    console.log(`${operation}: ${duration}ms`);
    
    // Send to monitoring service
    analytics.track('contract_call', {
      operation,
      duration,
      success: true
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    analytics.track('contract_call', {
      operation,
      duration,
      success: false,
      error: error.message
    });
    throw error;
  }
};

// Usage
const result = await measureContractCall('contribute', () =>
  contract.contribute(groupId, amount)
);
```

#### 3. Network Performance

**Monitor RPC latency:**
```javascript
const monitorRPCLatency = async (rpcCall) => {
  const start = Date.now();
  const result = await rpcCall();
  const latency = Date.now() - start;
  
  if (latency > 3000) {
    console.warn(`Slow RPC call: ${latency}ms`);
  }
  
  return result;
};
```

### Monitoring Tools

#### 1. Lighthouse CI

Run automated Lighthouse audits in CI/CD:

```bash
# Install
npm install -g @lhci/cli

# Run audit
lhci autorun --config .lighthouserc.json
```

**Configuration:**
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3,
      "url": ["http://localhost:4173"]
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.85}],
        "categories:accessibility": ["error", {"minScore": 0.90}]
      }
    }
  }
}
```

#### 2. Performance Dashboard

Track metrics over time using the automated dashboard (see [performance-benchmarking.md](performance-benchmarking.md)).

**Key metrics tracked:**
- Gas costs per function
- Lighthouse scores
- Web Vitals
- Bundle sizes
- API response times

---

## Benchmarking Instructions

### Contract Benchmarking

#### 1. Gas Benchmarks

**Run all benchmarks:**
```bash
cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark -- --nocapture
```

**Run specific benchmark:**
```bash
cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark_create_group_gas -- --nocapture
```

**With detailed output:**
```bash
RUST_BACKTRACE=1 cargo test --manifest-path contracts/stellar-save/Cargo.toml benchmark -- --nocapture --test-threads=1
```

#### 2. Storage Benchmarks

**Analyze storage usage:**
```bash
# Run storage analysis
cargo test --manifest-path contracts/stellar-save/Cargo.toml test_storage_analysis -- --nocapture

# Compare traditional vs optimized
cargo test --manifest-path contracts/stellar-save/Cargo.toml test_storage_comparison -- --nocapture
```

**Expected output:**
```
Storage Analysis Report
========================
Members: 100
Cycles: 10

Traditional Approach: 1405 entries
Optimized Approach: 235 entries
Savings: 83%
```

#### 3. Custom Benchmarks

**Create custom benchmark:**
```rust
#[test]
fn benchmark_custom_operation() {
    let env = Env::default();
    env.budget().reset_unlimited();
    
    // Setup
    let contract = create_contract(&env);
    
    // Measure
    let start = env.budget().cpu_instruction_cost();
    contract.custom_operation();
    let end = env.budget().cpu_instruction_cost();
    
    let gas_used = end - start;
    println!("Gas used: {}", gas_used);
    assert!(gas_used < TARGET_GAS);
}
```

### Frontend Benchmarking

#### 1. Lighthouse Audits

**Run locally:**
```bash
# Build production bundle
cd frontend
npm run build

# Start preview server
npm run preview -- --host 127.0.0.1 --port 4173

# In another terminal, run Lighthouse
npx lighthouse http://127.0.0.1:4173 --output html --output-path ./lighthouse-report.html
```

**Run with CI configuration:**
```bash
npx lhci autorun --config .lighthouserc-perf.json
```

#### 2. Bundle Size Analysis

**Analyze bundle:**
```bash
# Install analyzer
npm install -D rollup-plugin-visualizer

# Build with analysis
npm run build -- --mode production

# View report
open stats.html
```

**Check bundle sizes:**
```bash
# List all chunks
ls -lh dist/assets/

# Check total size
du -sh dist/
```

**Targets:**
- Main bundle: < 200KB (gzipped)
- Vendor bundle: < 150KB (gzipped)
- Total initial load: < 350KB (gzipped)

#### 3. Runtime Performance

**Profile React components:**
```javascript
import { Profiler } from 'react';

<Profiler id="GroupList" onRender={onRenderCallback}>
  <GroupList groups={groups} />
</Profiler>

function onRenderCallback(
  id, phase, actualDuration, baseDuration, startTime, commitTime
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}
```

**Measure render time:**
```javascript
import { useEffect } from 'react';

useEffect(() => {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    console.log(`Component mounted for ${duration}ms`);
  };
}, []);
```

### Continuous Benchmarking

#### 1. Automated CI Benchmarks

The project runs automated benchmarks on every PR and merge. See [performance-benchmarking.md](performance-benchmarking.md) for details.

**Workflow triggers:**
- On pull request
- On push to main
- Weekly scheduled runs

**Outputs:**
- PR comments with results
- Performance dashboard
- Regression alerts

#### 2. Local Benchmark Script

**Run all benchmarks:**
```bash
./scripts/run_benchmarks.sh
```

**Script includes:**
- Contract gas benchmarks
- Storage analysis
- Frontend Lighthouse audit
- Bundle size check

#### 3. Regression Detection

**Thresholds:**
- Gas increase > 10%: Warning
- Lighthouse score decrease > 5 points: Warning
- Bundle size increase > 20%: Warning

**Response:**
- Review changes causing regression
- Optimize if necessary
- Document intentional increases

### Benchmark Reporting

#### 1. Generate Report

```bash
# Full performance report
./scripts/generate_performance_report.sh

# Output: performance-report.md
```

**Report includes:**
- Gas costs for all functions
- Storage usage analysis
- Frontend metrics
- Historical trends
- Recommendations

#### 2. Compare Branches

```bash
# Compare current branch to main
./scripts/compare_performance.sh main

# Output: performance-comparison.md
```

#### 3. Track Over Time

Performance data is stored in `performance-results/` and tracked in Git for historical analysis.

**View trends:**
```bash
# Show gas cost trends
cat performance-results/gas-trends.json

# Show Lighthouse trends
cat performance-results/lighthouse-trends.json
```

---

## Performance Checklist

### For Developers

**Before submitting PR:**
- [ ] Run gas benchmarks locally
- [ ] Check contract size (< 80KB warning, < 100KB limit)
- [ ] Run Lighthouse audit (scores > 85)
- [ ] Check bundle size (< 350KB initial load)
- [ ] Profile critical paths
- [ ] Review storage usage
- [ ] Test on slow network (throttled)

**Code review focus:**
- [ ] Unnecessary storage operations
- [ ] Inefficient loops
- [ ] Missing memoization
- [ ] Large bundle imports
- [ ] Unoptimized images
- [ ] Missing caching

### For Users

**Creating groups:**
- [ ] Choose appropriate group size (< 100 recommended)
- [ ] Set reasonable cycle duration
- [ ] Consider gas costs in contribution amount

**Contributing:**
- [ ] Contribute early in cycle
- [ ] Monitor network congestion
- [ ] Use recommended gas limits

**Monitoring:**
- [ ] Check group performance metrics
- [ ] Review transaction costs
- [ ] Report performance issues

---

## Additional Resources

- [Storage Optimization Guide](storage-optimization.md) - Detailed storage optimization strategies
- [Size Optimization Guide](size-optimization.md) - Contract size reduction techniques
- [Performance Benchmarking](performance-benchmarking.md) - Automated benchmarking pipeline
- [Performance Config](performance-config.json) - Threshold configurations
- [Architecture Documentation](architecture.md) - System architecture overview

---

## Getting Help

**Performance issues?**
- Check [GitHub Issues](https://github.com/Xoulomon/Stellar-Save/issues) for known issues
- Review [FAQ](faq.md) for common questions
- Join [Discussions](https://github.com/Xoulomon/Stellar-Save/discussions) for community help

**Found a performance bug?**
- Open an issue with benchmark results
- Include reproduction steps
- Provide profiling data if available

---

**Last Updated:** April 2026  
**Maintained by:** Stellar-Save Contributors
