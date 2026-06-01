/**
 * Tests for configuration module, especially DATABASE_URL construction
 * from Secrets Manager environment variables.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Config - Database URL Construction', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to clear cached config
    jest.resetModules();
    // Clone environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should use DATABASE_URL when provided directly', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/testdb');
  });

  it('should construct DATABASE_URL from individual components (Secrets Manager)', async () => {
    delete process.env.DATABASE_URL;
    process.env.DB_USERNAME = 'dbuser';
    process.env.DB_PASSWORD = 'dbpass123';
    process.env.DB_HOST = 'rds.amazonaws.com';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'stellarsave';
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe(
      'postgresql://dbuser:dbpass123@rds.amazonaws.com:5432/stellarsave'
    );
  });

  it('should prioritize DATABASE_URL over individual components', async () => {
    process.env.DATABASE_URL = 'postgresql://direct:url@host:5432/db';
    process.env.DB_USERNAME = 'component';
    process.env.DB_PASSWORD = 'component';
    process.env.DB_HOST = 'component.host';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'component';
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe('postgresql://direct:url@host:5432/db');
  });

  it('should use fallback when neither DATABASE_URL nor components provided', async () => {
    delete process.env.DATABASE_URL;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/stellar_save');
  });

  it('should use fallback when components are incomplete', async () => {
    delete process.env.DATABASE_URL;
    process.env.DB_USERNAME = 'user';
    process.env.DB_PASSWORD = 'pass';
    // Missing DB_HOST, DB_PORT, DB_NAME
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/stellar_save');
  });

  it('should handle special characters in password', async () => {
    delete process.env.DATABASE_URL;
    process.env.DB_USERNAME = 'user';
    process.env.DB_PASSWORD = 'p@ss!w0rd#123';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'db';
    
    const { config } = await import('../config');
    
    expect(config.database.url).toBe('postgresql://user:p@ss!w0rd#123@localhost:5432/db');
  });
});
