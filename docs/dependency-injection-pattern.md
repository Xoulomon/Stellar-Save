# Dependency Injection Architectural Pattern

## Overview
This document outlines the standard Dependency Injection (DI) pattern adopted across core backend services in Stellar-Save (Issue #1701).

Historically, services directly instantiated database clients (`new PrismaClient()`), external SDKs (Elasticsearch `Client`, AWS `SecretsManagerClient`), and global config / loggers. This made unit testing difficult, necessitating extensive module-level mocking (`jest.mock(...)`) that obscured tests and leaked global state between suites.

---

## The DI Pattern for Services

All core backend services must conform to the **Constructor Dependency Injection** pattern with optional parameter defaults.

### Key Rules
1. **Define a dedicated `*Deps` interface**:
   Export an interface named `<ServiceName>Deps` containing all external collaborators (`db`, `client`, `logger`, `config`).
2. **Accept `deps?: <ServiceName>Deps` in constructor**:
   Allow callers (including production singletons) to instantiate with zero arguments (`new ServiceName()`) while resolving to default production dependencies.
3. **Store dependencies in `private readonly` instance properties**:
   Never access global singletons inside service methods when an injected dependency exists.
4. **Avoid `any`**:
   Use exact model types or minimal structural interfaces to satisfy strict TypeScript and ESLint standards.
5. **Export a default singleton** for backwards compatibility with legacy call sites:
   `export const myService = new MyService();`

### Standard Service Template

```typescript
import { config } from './config';
import { logger } from './logger';
import { prisma } from './prisma_client';
import type { PrismaClient } from '@prisma/client';

export interface MyServiceDeps {
  db?: PrismaClient;
  config?: typeof config;
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
}

export class MyService {
  private readonly db: PrismaClient;
  private readonly log: NonNullable<MyServiceDeps['logger']>;
  private readonly config: typeof config;

  constructor(deps?: MyServiceDeps) {
    this.db = deps?.db ?? prisma;
    this.log = deps?.logger ?? logger;
    this.config = deps?.config ?? config;
  }

  async performAction(): Promise<void> {
    this.log.info('Executing action with injected dependencies');
    await this.db.myModel.findMany();
  }
}

/** Default singleton for production runtime */
export const myService = new MyService();
```

---

## Refactored Core Services (Issue #1701)

The following 10 core services have been refactored to accept injected dependencies:

1. **`ABTestingFramework` (`backend/src/ab_testing.ts`)**: Accepts `ABTestingDeps` with `bucketStore` mapping.
2. **`AdminService` (`backend/src/admin_service.ts`)**: Accepts `AdminServiceDeps` with isolated mockable dataset collections (`members`, `groups`, `transactions`, `auditLogs`).
3. **`DeviceTokenService` (`backend/src/device_token_service.ts`)**: Accepts `DeviceTokenServiceDeps` (`db`, `logger`).
4. **`SearchService` (`backend/src/search.ts`)**: Accepts `SearchServiceDeps` (`client`, `config`, `logger`).
5. **`WebPushService` (`backend/src/web_push_service.ts`)**: Accepts `WebPushServiceDeps` (`db`, `config`, `logger`).
6. **`NotificationService` (`backend/src/notification_service.ts`)**: Accepts `NotificationServiceDeps` (`db`, `config`, `logger`).
7. **`SecretsManagerService` (`backend/src/secrets_manager_service.ts`)**: Accepts `SecretsManagerServiceDeps` (`client`, `config`, `logger`).
8. **`PushNotificationService` (`backend/src/push_notification_service.ts`)**: Accepts `PushNotificationServiceDeps` (`providers`, `defaultProvider`, `config`, `logger`).
9. **`FraudDetectionService` (`backend/src/fraud_detection_service.ts`)**: Accepts `FraudDetectionServiceDeps` (`db`, `config`, `logger`).
10. **`ApiKeyService` (`backend/src/api_key_service.ts`)**: Accepts `ApiKeyServiceDeps` (`db`, `logger`).
11. **`BackupService` (`backend/src/backup_service.ts`)**: Accepts `s3Client` or `BackupServiceDeps`.

---

## Unit Testing with Injected Mocks

In unit tests, instantiate the service directly with mock objects:

```typescript
describe('MyService', () => {
  let mockDb: any;
  let mockLogger: any;
  let service: MyService;

  beforeEach(() => {
    mockDb = {
      myModel: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service = new MyService({ db: mockDb, logger: mockLogger });
  });

  it('runs cleanly without touching real DB or global modules', async () => {
    await service.performAction();
    expect(mockDb.myModel.findMany).toHaveBeenCalled();
  });
});
```
