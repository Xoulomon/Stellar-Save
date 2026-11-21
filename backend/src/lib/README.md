# Cloud Cost Provider System (Issue #1694)

This directory contains the pluggable cloud cost provider system that enables multi-cloud support.

## Quick Start

### Using AWS Provider (Default)
```typescript
import { CostManager } from './cost-manager';

const manager = CostManager.create('AWS');
const report = await manager.buildCostReport();
```

### Using Mock Provider (Testing)
```typescript
import { CostManager } from './cost-manager';

const manager = CostManager.create('Mock', {
  totalCost: 500,
  recommendationCount: 3,
});
const report = await manager.buildCostReport();
```

### Direct Usage with Dependency Injection
```typescript
import { CostManager } from './cost-manager';
import { AwsCostProvider } from './aws-cost-provider';

const provider = new AwsCostProvider();
const manager = new CostManager(provider);
const report = await manager.buildCostReport();
```

## Files

- **`cost-provider.ts`**: Interface and base class defining the cost provider contract
- **`aws-cost-provider.ts`**: AWS implementation using Cost Explorer and Compute Optimizer
- **`mock-cost-provider.ts`**: Mock implementation for testing without AWS API calls
- **`cost-manager.ts`**: Orchestration layer and factory for creating providers

## Adding a New Provider

1. Create a new class extending `BaseCostProvider`
2. Implement all required methods from `CostProvider` interface
3. Register in `CostManager.create()` factory method
4. Add tests in `backend/src/tests/cost-provider.test.ts`

Example:
```typescript
export class GcpCostProvider extends BaseCostProvider {
  async fetchCostByService(days = 30): Promise<ServiceCost[]> {
    // GCP implementation
  }
  
  async fetchComputeRecommendations(): Promise<OptimizationRecommendation[]> {
    // GCP recommendations
  }
  
  async buildCostReport(): Promise<CostReport> {
    // Aggregate data
  }
  
  getProviderName(): string {
    return 'GCP';
  }
}
```

## Testing

Run tests:
```bash
npm run test -- cost-provider.test.ts
```

Mock provider is perfect for:
- Unit testing cost logic
- Development without AWS credentials
- CI/CD pipelines
- Testing cost spike detection

## Backward Compatibility

The original `aws_cost_service.ts` remains unchanged. New code should use the `CostProvider` interface and `CostManager` for cleaner architecture.

## Related Issues

- #1694: Extract AWS cost service into a pluggable cloud-cost interface
