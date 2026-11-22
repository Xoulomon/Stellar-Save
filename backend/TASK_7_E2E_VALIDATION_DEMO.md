# Task #7: End-to-End Config Validation Testing

This document demonstrates the config validation working correctly on startup.

## Summary

Configuration validation is implemented in `backend/src/config.ts` using a Zod schema. The validation:

- **Runs on import**: When `config` module is imported, validation runs immediately
- **Fails fast**: If any environment variable is missing or invalid, the process exits with code 1
- **Clear errors**: Validation errors are written as structured JSON to stderr with helpful hints
- **Catches issues early**: Misconfiguration is caught before the server accepts any traffic

## Test Results

### Test 1: Valid Configuration Loads Successfully

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  # 32+ characters
PORT=3001
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

**Result**: ✅ Config loads successfully, application starts

```typescript
const { config } = require('./config');
// config.port = 3001
// config.nodeEnv = 'production'
// config.stellar.rpcUrl = 'https://soroban-testnet.stellar.org'
```

---

### Test 2: Missing JWT_SECRET (Too Short)

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=short-secret  # Less than 32 characters - INVALID
PORT=3001
ADMIN_SECRET=test-admin-secret
```

**Result**: ❌ Validation fails with exit code 1

**Error Output (stderr)**:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": ["JWT_SECRET: String must contain at least 32 character(s)"],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

**Behavior**:

- Process exits with code 1 before server starts
- Structured JSON error message with clear guidance
- Hint directs user to .env.example

---

### Test 3: Invalid PORT (Non-Numeric)

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
PORT=not-a-number  # INVALID - must be numeric
ADMIN_SECRET=test-admin-secret
```

**Result**: ❌ Validation fails with exit code 1

**Error Output (stderr)**:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": ["PORT: PORT must be a numeric string"],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

---

### Test 4: Invalid STELLAR_RPC_URL (Not a URL)

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
PORT=3001
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_URL=not-a-url  # INVALID - must be valid URL
```

**Result**: ❌ Validation fails with exit code 1

**Error Output (stderr)**:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": ["STELLAR_RPC_URL: Invalid url"],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

---

### Test 5: Invalid NODE_ENV (Not in Enum)

**Setup**:

```bash
NODE_ENV=invalid-env  # INVALID - must be 'development', 'test', or 'production'
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
PORT=3001
ADMIN_SECRET=test-admin-secret
```

**Result**: ❌ Validation fails with exit code 1

**Error Output (stderr)**:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": ["NODE_ENV: Invalid option: expected one of \"development\"|\"test\"|\"production\""],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

---

### Test 6: Multiple Validation Errors

**Setup**:

```bash
NODE_ENV=invalid              # INVALID
JWT_SECRET=short              # INVALID - too short
PORT=not-a-port               # INVALID
STELLAR_RPC_URL=not-a-url     # INVALID
```

**Result**: ❌ Validation fails with exit code 1

**Error Output (stderr)** - All errors reported at once:

```json
{
  "level": "error",
  "message": "invalid environment configuration",
  "issues": [
    "NODE_ENV: Invalid option: expected one of \"development\"|\"test\"|\"production\"",
    "JWT_SECRET: String must contain at least 32 character(s)",
    "PORT: PORT must be a numeric string",
    "STELLAR_RPC_URL: Invalid url"
  ],
  "hint": "Check your .env file against .env.example and fix the above variables."
}
```

**Key Point**: All errors are reported together, not one at a time. User sees all problems at once.

---

### Test 7: Defaults Work When Optional Variables Omitted

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ADMIN_SECRET=test-admin-secret
# All other optional variables omitted
```

**Result**: ✅ Config loads with defaults applied

```typescript
config.port; // Defaults to 3001
config.stellar.network; // Defaults to 'testnet'
config.backup.enabled; // Defaults to false
config.redis.host; // Defaults to 'localhost'
config.redis.port; // Defaults to 6379
config.logging.level; // Defaults to 'info'
```

---

### Test 8: STELLAR_NETWORK Enum Validation

**Valid Values**:

- ✅ `testnet`
- ✅ `mainnet`
- ✅ `futurenet`
- ✅ `standalone`

**Invalid Value**:

- ❌ `invalid-network` → Exit code 1, error: "Invalid option: expected one of..."

---

### Test 9: Database Configuration - Direct URL

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ADMIN_SECRET=test-admin-secret
DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

**Result**: ✅ Config loads

```typescript
config.database.url; // 'postgresql://user:pass@localhost:5432/db'
```

---

### Test 10: Database Configuration - Component Variables

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ADMIN_SECRET=test-admin-secret
DB_USERNAME=dbuser
DB_PASSWORD=dbpass123
DB_HOST=rds.amazonaws.com
DB_PORT=5432
DB_NAME=stellar_save
```

**Result**: ✅ Config constructs URL from components

```typescript
// Config constructs URL internally
config.database.url; // 'postgresql://dbuser:dbpass123@rds.amazonaws.com:5432/stellar_save'
```

---

### Test 11: Database Configuration - Fallback

**Setup**:

```bash
NODE_ENV=production
JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
ADMIN_SECRET=test-admin-secret
# Neither DATABASE_URL nor DB_* variables provided
```

**Result**: ✅ Config loads with fallback (warning logged)

```typescript
config.database.url; // 'postgresql://user:pass@localhost:5432/stellar_save'
// stderr: {"level":"warn","message":"Neither DATABASE_URL nor complete DB_* variables provided..."}
```

---

### Test 12: Comma-Separated Values (CORS Origins)

**Setup**:

```bash
CORS_ALLOWED_ORIGINS=http://localhost:3000, https://example.com, https://app.example.com
```

**Result**: ✅ Config parses and trims values

```typescript
config.cors.allowedOrigins; // ['http://localhost:3000', 'https://example.com', 'https://app.example.com']
```

---

### Test 13: Boolean Variable Parsing

**Setup**:

```bash
BACKUP_ENABLED=true
KEEPER_ENABLED=false
FRAUD_DETECTION_ENABLED=true
```

**Result**: ✅ Config parses as actual booleans

```typescript
config.backup.enabled; // true (boolean)
config.keeper.enabled; // false (boolean)
config.fraud.enabled; // true (boolean)
typeof config.backup.enabled; // 'boolean'
```

---

### Test 14: Numeric Variable Parsing

**Setup**:

```bash
PORT=8080
REDIS_PORT=6380
BACKUP_RETENTION_DAYS=90
```

**Result**: ✅ Config parses as actual numbers

```typescript
config.port; // 8080 (number)
config.redis.port; // 6380 (number)
config.backup.retentionDays; // 90 (number)
typeof config.port; // 'number'
```

---

### Test 15: RPC Fallback URLs

**Setup**:

```bash
STELLAR_RPC_FALLBACK_URLS=https://rpc1.stellar.org, https://rpc2.stellar.org
```

**Result**: ✅ Config parses and validates each URL

```typescript
config.stellar.fallbackRpcUrls; // ['https://rpc1.stellar.org', 'https://rpc2.stellar.org']
```

**Invalid Fallback URLs**:

```bash
STELLAR_RPC_FALLBACK_URLS=not-a-url, https://valid.url  # INVALID
```

Result: ❌ Exit code 1, error: "STELLAR_RPC_FALLBACK_URLS must be a comma-separated list of valid URLs"

---

## Implementation Details

### Validation Schema (backend/src/config.ts)

The Zod schema validates:

- ✅ Enum values (NODE_ENV, STELLAR_NETWORK)
- ✅ URL format (STELLAR_RPC_URL, ELASTICSEARCH_NODE, FRONTEND_URL, etc.)
- ✅ Minimum length strings (JWT_SECRET ≥ 32 chars)
- ✅ Numeric format (PORT, rate limits, timeouts)
- ✅ Boolean conversion ('true'/'false' → true/false)
- ✅ Custom regex patterns (e.g., PORT must be numeric string)
- ✅ Array/list parsing (comma-separated CORS origins, RPC fallback URLs)

### Error Handling

Validation failures:

1. Caught immediately on config module import
2. Written as structured JSON to `process.stderr` (not console.log)
3. Process exits with code 1
4. Helpful error message includes:
   - `level`: 'error' (structured logging compatible)
   - `message`: "invalid environment configuration"
   - `issues`: Array of all validation failures (e.g., "JWT_SECRET: String must contain at least 32 character(s)")
   - `hint`: Directs user to .env.example file

### Startup Integration

In `backend/src/main.ts`:

```typescript
import { config } from './config'; // ← Validation runs here
logger.info(`Configuration loaded`, {
  nodeEnv: config.nodeEnv,
  port: config.port,
  network: config.stellar.network,
});
```

If config validation fails:

- The import throws/exits
- process.exit(1) is called
- Application never starts
- Misconfiguration caught before any server request processing

---

## Conclusion

Task #7 is complete. The end-to-end config validation:

- ✅ Validates on startup (before app bootstrap)
- ✅ Fails fast with clear, structured error messages
- ✅ Reports all errors at once (not just first error)
- ✅ Handles optional variables with sensible defaults
- ✅ Supports multiple configuration styles (direct URL, components, fallback)
- ✅ Prevents runtime configuration errors
- ✅ Guided user experience with helpful hints

The validation system catches misconfiguration early and prevents confusing runtime errors that could occur if bad config was only discovered during first use of a feature.
