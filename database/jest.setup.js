/**
 * Jest setup file for database migration tests
 * Sets default environment variables if not provided
 */

// Set default test database URL if not provided
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = 
    'postgresql://postgres:postgres@localhost:5433/stellar_save_test';
}

// Increase Jest timeout for database operations
jest.setTimeout(30000);
