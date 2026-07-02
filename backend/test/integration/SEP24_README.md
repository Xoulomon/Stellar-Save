# SEP-24 Fiat Ramp Integration Tests

This directory contains comprehensive integration tests for the SEP-24 (Hosted Deposit and Withdrawal) protocol implementation, validating the full deposit/withdraw flow against a mock anchor sandbox.

## Overview

The SEP-24 protocol enables users to deposit and withdraw fiat currencies through anchor services. These tests ensure our implementation correctly handles:

- **SEP-10 Authentication**: Web authentication flow
- **Deposit Flows**: Interactive deposit initiation and completion
- **Withdraw Flows**: Interactive withdrawal initiation and completion
- **Status Polling**: Transaction status monitoring
- **Failure Scenarios**: Error handling and refund paths
- **Protocol Compliance**: Adherence to Stellar SEP-24 specification

## Test Architecture

### Components

1. **SEP-24 Sandbox** (`backend/test/helpers/sep24-sandbox.ts`)
   - Mock anchor server implementing SEP-24 protocol
   - Provides all required endpoints (SEP-1, SEP-10, SEP-24)
   - Simulates transaction state transitions
   - Enables testing without external dependencies

2. **Integration Tests** (`backend/test/integration/sep24-fiat-ramp.test.ts`)
   - Full end-to-end test coverage
   - Happy path and failure scenarios
   - Authorization and error handling
   - Protocol compliance validation

3. **CI Integration** (`.github/workflows/sep24-integration.yml`)
   - Automated testing in CI/CD pipeline
   - Nightly regression tests
   - Sandbox validation checks

## Running the Tests

### Prerequisites

```bash
# Install dependencies
cd backend
npm ci

# Start test database (if running locally)
docker compose -f test/docker-compose.test.yml up -d postgres-test
```

### Run Tests Locally

```bash
# Run all integration tests
npm run test:integration

# Run only SEP-24 tests
npm run test:integration -- --testPathPattern=sep24-fiat-ramp

# Run with coverage
npm run test:integration -- --coverage --testPathPattern=sep24-fiat-ramp

# Run specific test suite
npm run test:integration -- --testNamePattern="Deposit Flow"
```

### Run with Docker Compose

```bash
# Start all test services (including SEP-24 sandbox)
docker compose -f test/docker-compose.test.yml up -d

# Run tests
npm run test:integration

# Clean up
docker compose -f test/docker-compose.test.yml down
```

## Test Coverage

### SEP-1: Stellar Info File
- ✅ stellar.toml discovery
- ✅ Required endpoint presence
- ✅ Anchor configuration validation

### SEP-10: Web Authentication
- ✅ Challenge transaction generation
- ✅ JWT token issuance
- ✅ Token expiration handling
- ✅ Invalid request handling

### SEP-24: Deposit Flow
- ✅ Deposit initiation
- ✅ Interactive URL generation
- ✅ Status transitions: incomplete → pending_user_transfer_start → pending_anchor → pending_stellar → completed
- ✅ Transaction completion with Stellar TX ID
- ✅ Deposit with various amounts
- ✅ Full end-to-end deposit flow

### SEP-24: Withdraw Flow
- ✅ Withdraw initiation
- ✅ Interactive URL generation
- ✅ Status monitoring through completion
- ✅ External payment processing
- ✅ Full end-to-end withdraw flow

### Failure and Refund Paths
- ✅ Deposit failures with error messages
- ✅ Withdraw failures with appropriate errors
- ✅ Refund scenarios with memo
- ✅ Transaction expiration handling
- ✅ Insufficient funds scenarios
- ✅ Bank verification failures

### Authorization and Security
- ✅ Unauthorized access prevention
- ✅ Missing token handling
- ✅ Invalid token rejection
- ✅ Token validation for all endpoints

### Error Handling
- ✅ Missing required parameters
- ✅ Invalid transaction IDs
- ✅ Non-existent transactions
- ✅ Malformed requests

## Test Structure

```typescript
describe('SEP-24 Fiat Ramp Integration Tests', () => {
  describe('SEP-1: stellar.toml Discovery', () => {
    // Anchor info file tests
  });

  describe('SEP-10: Web Authentication', () => {
    // Authentication flow tests
  });

  describe('SEP-24: Deposit Flow (Happy Path)', () => {
    // Successful deposit scenarios
  });

  describe('SEP-24: Withdraw Flow (Happy Path)', () => {
    // Successful withdrawal scenarios
  });

  describe('SEP-24: Failure and Refund Paths', () => {
    // Error and refund scenarios
  });

  describe('SEP-24: Authorization and Error Handling', () => {
    // Security and validation tests
  });

  describe('SEP-24: End-to-End Scenarios', () => {
    // Full workflow integration tests
  });
});
```

## Continuous Integration

### GitHub Actions Workflow

The SEP-24 tests run automatically:
- On every push to `main` and `develop` branches
- On all pull requests affecting backend code
- Nightly at 2 AM UTC for regression detection

### CI Steps

1. **Setup**: Provision PostgreSQL test database
2. **Build**: Install dependencies and build project
3. **Test**: Run SEP-24 integration test suite
4. **Report**: Upload test results and coverage
5. **Validate**: Verify sandbox Docker image builds correctly

### Viewing Results

- Test results are uploaded as artifacts on every run
- Failed tests trigger automatic PR comments
- Coverage reports are available in the artifacts section

## Mock Anchor Sandbox

The sandbox simulates a SEP-24 compliant anchor with:

### Implemented Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/stellar.toml` | GET | Anchor configuration |
| `/auth` | GET | SEP-10 challenge request |
| `/auth` | POST | SEP-10 challenge submission |
| `/transactions/deposit/interactive` | POST | Initiate deposit |
| `/transactions/withdraw/interactive` | POST | Initiate withdrawal |
| `/transaction` | GET | Get transaction status |
| `/test/advance-transaction` | POST | Test helper to advance transaction state |

### Transaction States

The sandbox supports all SEP-24 transaction statuses:
- `incomplete`: Awaiting user action
- `pending_user_transfer_start`: Waiting for user transfer
- `pending_anchor`: Anchor processing
- `pending_stellar`: Stellar network processing
- `pending_external`: External payment processing
- `completed`: Successfully completed
- `refunded`: Transaction refunded
- `expired`: Transaction expired
- `error`: Transaction failed

## Debugging

### Enable Verbose Logging

```bash
# Set debug environment variable
DEBUG=sep24:* npm run test:integration -- --testPathPattern=sep24-fiat-ramp
```

### Inspect Sandbox State

The sandbox includes helper endpoints for testing:

```bash
# Advance transaction to next state (test helper)
curl -X POST http://localhost:8545/test/advance-transaction \
  -H "Content-Type: application/json" \
  -d '{"id": "tx-id", "status": "completed"}'
```

### Common Issues

1. **Port 8545 already in use**
   - Solution: Kill existing process or change sandbox port

2. **Database connection fails**
   - Solution: Ensure PostgreSQL test container is running

3. **Token validation fails**
   - Solution: Check that auth flow completes before transaction requests

## Future Enhancements

- [ ] Add SEP-31 (cross-border payments) support
- [ ] Implement SEP-6 (deposit/withdrawal) as alternative flow
- [ ] Add multi-currency support beyond USDC
- [ ] Implement KYC simulation for compliance testing
- [ ] Add rate limiting tests
- [ ] Test concurrent transaction processing
- [ ] Add transaction reconciliation tests
- [ ] Implement webhook notification testing

## Resources

- [SEP-24 Specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
- [SEP-10 Specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
- [Stellar Anchor Platform](https://github.com/stellar/java-stellar-anchor-sdk)
- [Testing Best Practices](https://stellar.org/developers/docs/anchoring-assets/testing)

## Contributing

When adding new SEP-24 features:

1. Add corresponding sandbox endpoints if needed
2. Write integration tests covering happy and failure paths
3. Update this README with new test coverage
4. Ensure CI passes before submitting PR
5. Include test results in PR description

## Support

For questions or issues:
- Check existing tests for examples
- Review SEP-24 specification
- Create an issue with "SEP-24" label
- Tag @stellar-save/backend-team for review
