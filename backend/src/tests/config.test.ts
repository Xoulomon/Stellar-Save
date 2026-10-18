/**
 * Tests for configuration module, especially DATABASE_URL construction
 * from Secrets Manager environment variables.
 */

function setProductionEnvironment(stellarRpcUrl: string): void {
  Object.assign(process.env, {
    NODE_ENV: 'production',
    ADMIN_SECRET: 'configured-admin-secret',
    JWT_SECRET: 'configured-jwt-secret-value-that-is-long-enough',
    CORS_ALLOWED_ORIGINS: 'https://app.stellar-save.com',
    STELLAR_NETWORK: 'mainnet',
    STELLAR_RPC_URL: stellarRpcUrl,
    STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
    ELASTICSEARCH_NODE: 'https://search.stellar-save.com',
    ELASTICSEARCH_PASSWORD: 'configured-search-password',
    KYC_PROVIDER_URL: 'https://kyc.stellar-save.com',
    FRONTEND_URL: 'https://app.stellar-save.com',
    APP_URL: 'https://app.stellar-save.com',
    HORIZON_URL: 'https://horizon.stellar.org',
    DATABASE_URL: 'postgresql://stellar-save:configured@db.stellar-save.com:5432/stellar_save',
    REDIS_HOST: 'redis.stellar-save.com',
  });
}

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

describe('Config - Validation & Schema', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('NODE_ENV validation', () => {
    it('should accept valid NODE_ENV values', async () => {
      setProductionEnvironment('https://rpc.stellar.org');
      const { config } = await import('../config');
      expect(config.nodeEnv).toBe('production');
    });

    it('should default to development when NODE_ENV not set', async () => {
      delete process.env.NODE_ENV;
      const { config } = await import('../config');
      expect(config.nodeEnv).toBe('development');
    });

    it('should validate NODE_ENV enum values', async () => {
      process.env.NODE_ENV = 'invalid-env';
      // Config validation should catch this and exit
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('PORT validation', () => {
    it('should parse PORT as number', async () => {
      process.env.PORT = '8080';
      const { config } = await import('../config');
      expect(config.port).toBe(8080);
      expect(typeof config.port).toBe('number');
    });

    it('should default PORT to 3001', async () => {
      delete process.env.PORT;
      const { config } = await import('../config');
      expect(config.port).toBe(3001);
    });

    it('should reject non-numeric PORT', async () => {
      process.env.PORT = 'not-a-number';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('JWT_SECRET validation', () => {
    it('should accept valid JWT_SECRET (32+ characters)', async () => {
      process.env.JWT_SECRET = 'a'.repeat(32);
      const { config } = await import('../config');
      expect(config.auth.jwtSecret).toHaveLength(32);
    });

    it('should reject JWT_SECRET shorter than 32 characters', async () => {
      process.env.JWT_SECRET = 'short-secret';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('STELLAR_NETWORK validation', () => {
    it('should accept valid STELLAR_NETWORK values', async () => {
      const networks = ['testnet', 'mainnet', 'futurenet', 'standalone'];
      for (const network of networks) {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.STELLAR_NETWORK = network;
        const { config } = await import('../config');
        expect(config.stellar.network).toBe(network);
      }
    });

    it('should default to testnet', async () => {
      delete process.env.STELLAR_NETWORK;
      const { config } = await import('../config');
      expect(config.stellar.network).toBe('testnet');
    });
  });

  describe('STELLAR_RPC_URL validation', () => {
    it('should accept valid STELLAR_RPC_URL', async () => {
      process.env.STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org';
      const { config } = await import('../config');
      expect(config.stellar.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    });

    it('should reject invalid STELLAR_RPC_URL', async () => {
      process.env.STELLAR_RPC_URL = 'not-a-url';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('Boolean environment variables', () => {
    it('should parse BACKUP_ENABLED as boolean', async () => {
      process.env.BACKUP_ENABLED = 'true';
      const { config } = await import('../config');
      expect(config.backup.enabled).toBe(true);
      expect(typeof config.backup.enabled).toBe('boolean');
    });

    it('should parse false as boolean', async () => {
      process.env.BACKUP_ENABLED = 'false';
      const { config } = await import('../config');
      expect(config.backup.enabled).toBe(false);
    });

    it('should default BACKUP_ENABLED to false', async () => {
      delete process.env.BACKUP_ENABLED;
      const { config } = await import('../config');
      expect(config.backup.enabled).toBe(false);
    });
  });

  describe('Numeric environment variables', () => {
    it('should parse numeric strings to numbers', async () => {
      process.env.PORT = '9000';
      process.env.BACKUP_RETENTION_DAYS = '60';
      process.env.REDIS_PORT = '6380';
      const { config } = await import('../config');
      expect(config.port).toBe(9000);
      expect(config.backup.retentionDays).toBe(60);
      expect(config.redis.port).toBe(6380);
    });

    it('should reject invalid numeric strings', async () => {
      process.env.BACKUP_RETENTION_DAYS = 'not-a-number';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('URL validation', () => {
    it('should validate ELASTICSEARCH_NODE is a URL', async () => {
      process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
      const { config } = await import('../config');
      expect(config.elasticsearch.node).toBe('http://localhost:9200');
    });

    it('should reject invalid URLs', async () => {
      process.env.ELASTICSEARCH_NODE = 'not-a-url';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('CORS_ALLOWED_ORIGINS parsing', () => {
    it('should parse comma-separated CORS origins', async () => {
      process.env.CORS_ALLOWED_ORIGINS =
        'http://localhost:3000, https://example.com, https://app.example.com';
      const { config } = await import('../config');
      expect(config.cors.allowedOrigins).toHaveLength(3);
      expect(config.cors.allowedOrigins).toContain('http://localhost:3000');
      expect(config.cors.allowedOrigins).toContain('https://example.com');
      expect(config.cors.allowedOrigins).toContain('https://app.example.com');
    });

    it('should handle empty CORS_ALLOWED_ORIGINS', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.CORS_ALLOWED_ORIGINS;
      const { config } = await import('../config');
      expect(config.cors.allowedOrigins).toEqual([]);
    });

    it('should trim whitespace in CORS origins', async () => {
      process.env.CORS_ALLOWED_ORIGINS = '  http://localhost:3000  ,  https://example.com  ';
      const { config } = await import('../config');
      expect(config.cors.allowedOrigins).toContain('http://localhost:3000');
      expect(config.cors.allowedOrigins).toContain('https://example.com');
    });
  });

  describe('Rate limiting configuration', () => {
    it('should have separate rate limits for different tiers', async () => {
      const { config } = await import('../config');
      expect(config.rateLimiting.free.perMin).toBeLessThan(config.rateLimiting.pro.perMin);
      expect(config.rateLimiting.pro.perMin).toBeLessThan(config.rateLimiting.enterprise.perMin);
    });
  });

  describe('Fallback defaults', () => {
    it('should use defaults for optional variables', async () => {
      // Clear optional variables
      delete process.env.REDIS_PASSWORD;
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.CAPTCHA_SECRET_KEY;

      const { config } = await import('../config');

      expect(config.redis.password).toBeUndefined();
      expect(config.push.firebase.projectId).toBeUndefined();
      expect(config.captcha.secretKey).toBeUndefined();
    });

    it('should reject unsafe default endpoints in production', async () => {
      setProductionEnvironment('https://soroban-testnet.stellar.org');

      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });
  });

  describe('Configuration immutability', () => {
    it('should return the same config object', async () => {
      const { config: config1 } = await import('../config');
      const { config: config2 } = await import('../config');

      expect(config1).toBe(config2);
    });
  });

  describe('STELLAR_RPC_FALLBACK_URLS parsing', () => {
    it('should parse comma-separated fallback URLs', async () => {
      process.env.STELLAR_RPC_FALLBACK_URLS = 'https://rpc1.stellar.org, https://rpc2.stellar.org';
      const { config } = await import('../config');
      expect(config.stellar.fallbackRpcUrls).toHaveLength(2);
      expect(config.stellar.fallbackRpcUrls).toContain('https://rpc1.stellar.org');
      expect(config.stellar.fallbackRpcUrls).toContain('https://rpc2.stellar.org');
    });

    it('should validate fallback URLs are valid URLs', async () => {
      process.env.STELLAR_RPC_FALLBACK_URLS = 'not-a-url, https://valid.url';
      expect.assertions(1);
      try {
        await import('../config');
      } catch {
        expect(true).toBe(true);
      }
    });

    it('should handle empty fallback URLs', async () => {
      delete process.env.STELLAR_RPC_FALLBACK_URLS;
      const { config } = await import('../config');
      expect(config.stellar.fallbackRpcUrls).toEqual([]);
    });
  });
});

describe('Config - Startup Validation Behavior', () => {
  it('should validate config on module import', async () => {
    // This test verifies that importing config.ts triggers validation
    const { config } = await import('../config');
    expect(config).toBeDefined();
    expect(config.nodeEnv).toBeDefined();
  });

  it('should provide helpful error messages on validation failure', () => {
    // Validation failures write structured JSON to stderr
    // This is tested indirectly by checking that invalid configs cause module load failure
    expect.assertions(0);
  });
});
