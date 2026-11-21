#!/bin/bash
# End-to-end tests for config validation at startup
# Tests that misconfiguration fails fast with clear error messages

set -e

echo "=== Config Validation E2E Tests ==="
echo ""

# Test 1: Missing JWT_SECRET (shorter than 32 chars)
echo "[Test 1] Missing JWT_SECRET (validation error)"
export NODE_ENV=production
export JWT_SECRET="short-secret"
export PORT=3001
export ADMIN_SECRET="test-admin-secret"

OUTPUT=$(node -e "
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'short-secret';
  process.env.PORT = '3001';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  try {
    require('../src/config');
  } catch (e) {
    // Expected to fail
  }
" 2>&1 || true)

if echo "$OUTPUT" | grep -q "JWT_SECRET"; then
  echo "✓ Validation correctly rejected short JWT_SECRET"
else
  echo "✗ Expected validation error for short JWT_SECRET"
  exit 1
fi

# Test 2: Invalid PORT (non-numeric)
echo "[Test 2] Invalid PORT (non-numeric)"
export JWT_SECRET="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
export PORT="not-a-number"

OUTPUT=$(node -e "
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.PORT = 'not-a-number';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  try {
    require('../src/config');
  } catch (e) {
    // Expected to fail
  }
" 2>&1 || true)

if echo "$OUTPUT" | grep -q "PORT"; then
  echo "✓ Validation correctly rejected non-numeric PORT"
else
  echo "✗ Expected validation error for non-numeric PORT"
  exit 1
fi

# Test 3: Invalid STELLAR_RPC_URL (not a URL)
echo "[Test 3] Invalid STELLAR_RPC_URL"
export PORT=3001
export STELLAR_RPC_URL="not-a-url"

OUTPUT=$(node -e "
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.PORT = '3001';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  process.env.STELLAR_RPC_URL = 'not-a-url';
  try {
    require('../src/config');
  } catch (e) {
    // Expected to fail
  }
" 2>&1 || true)

if echo "$OUTPUT" | grep -q "STELLAR_RPC_URL"; then
  echo "✓ Validation correctly rejected invalid STELLAR_RPC_URL"
else
  echo "✗ Expected validation error for invalid STELLAR_RPC_URL"
  exit 1
fi

# Test 4: Valid configuration (should succeed)
echo "[Test 4] Valid configuration"
export STELLAR_RPC_URL="https://soroban-testnet.stellar.org"

OUTPUT=$(node -e "
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.PORT = '3001';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  process.env.STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org';
  const config = require('../src/config').config;
  console.log(JSON.stringify({
    port: config.port,
    nodeEnv: config.nodeEnv,
    network: config.stellar.network
  }, null, 2));
" 2>&1 || true)

if echo "$OUTPUT" | grep -q "\"port\": 3001"; then
  echo "✓ Valid configuration loaded successfully"
else
  echo "✗ Valid configuration should have loaded"
  echo "Output: $OUTPUT"
  exit 1
fi

# Test 5: Error message structure (structured JSON on stderr)
echo "[Test 5] Error message structure (structured JSON)"
export JWT_SECRET="short"

OUTPUT=$(node -e "
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'short';
  process.env.PORT = '3001';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  try {
    require('../src/config');
  } catch (e) {
    // Expected to fail
  }
" 2>&1 || true)

if echo "$OUTPUT" | grep -q "\"level\": \"error\""; then
  echo "✓ Error output is structured JSON"
else
  echo "✗ Error output should be structured JSON with 'level' field"
  exit 1
fi

if echo "$OUTPUT" | grep -q "\"hint\""; then
  echo "✓ Error includes helpful hint"
else
  echo "✗ Error should include helpful hint"
  exit 1
fi

echo ""
echo "=== All E2E tests passed! ==="
