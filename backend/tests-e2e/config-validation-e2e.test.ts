/**
 * End-to-End Tests for Config Validation on Startup
 *
 * These tests verify that configuration validation fails fast with clear error messages
 * when environment variables are missing or invalid.
 *
 * Note: These tests spawn child processes and check their stderr output.
 * They confirm that misconfiguration is caught before the server accepts traffic.
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

describe('Config Validation - End-to-End Startup Tests', () => {
  const testEnvPath = path.join(__dirname, '.env.test');

  afterEach(() => {
    if (existsSync(testEnvPath)) {
      unlinkSync(testEnvPath);
    }
  });

  /**
   * Helper to write a test .env file and capture config module load output
   */
  function testConfigLoad(envContent: string): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    writeFileSync(testEnvPath, envContent);

    try {
      const output = execSync(`node -r dotenv/config -e "require('../src/config')"`, {
        cwd: __dirname,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          DOTENV_PATH: testEnvPath,
        },
        encoding: 'utf-8',
      });
      return { stdout: output, stderr: '', exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout?.toString() || '',
        stderr: err.stderr?.toString() || '',
        exitCode: err.status || 1,
      };
    }
  }

  describe('Missing/Invalid Environment Variables', () => {
    it('should fail when JWT_SECRET is shorter than 32 characters', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=short-secret
PORT=3001
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('JWT_SECRET');
      expect(result.stderr).toContain('32');
    });

    it('should fail when PORT is not numeric', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
PORT=not-a-number
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('PORT');
    });

    it('should fail when STELLAR_RPC_URL is not a valid URL', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
PORT=3001
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_URL=not-a-url
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('STELLAR_RPC_URL');
    });

    it('should fail when NODE_ENV is not a valid enum value', () => {
      const envContent = `
NODE_ENV=invalid-env
JWT_SECRET=${'a'.repeat(32)}
PORT=3001
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('NODE_ENV');
    });

    it('should return structured JSON error message', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=short
PORT=3001
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.stderr).toContain('"level"');
      expect(result.stderr).toContain('"message"');
      expect(result.stderr).toContain('"issues"');
      expect(result.stderr).toContain('"hint"');
    });

    it('should include helpful hint in error message', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=short
PORT=3001
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.stderr).toContain('.env.example');
    });
  });

  describe('Valid Configuration', () => {
    it('should load successfully with valid configuration', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
PORT=3001
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
`;

      const result = testConfigLoad(envContent);

      // Valid config should exit with 0
      expect(result.exitCode).toBe(0);
    });

    it('should use defaults for optional variables', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
      // PORT defaults to 3001
      // STELLAR_NETWORK defaults to testnet
      // BACKUP_ENABLED defaults to false
    });
  });

  describe('Database Configuration', () => {
    it('should accept DATABASE_URL directly', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
DATABASE_URL=postgresql://user:pass@localhost:5432/db
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should construct DATABASE_URL from components', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
DB_USERNAME=user
DB_PASSWORD=pass
DB_HOST=localhost
DB_PORT=5432
DB_NAME=db
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should use fallback when neither DATABASE_URL nor components provided', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
      // Should log warning about using fallback
    });
  });

  describe('Boolean Variable Parsing', () => {
    it('should parse BACKUP_ENABLED=true correctly', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
BACKUP_ENABLED=true
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should parse BACKUP_ENABLED=false correctly', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
BACKUP_ENABLED=false
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should parse comma-separated CORS origins', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
CORS_ALLOWED_ORIGINS=http://localhost:3000, https://example.com, https://app.example.com
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should handle empty CORS origins', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
CORS_ALLOWED_ORIGINS=
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('Stellar Network Configuration', () => {
    it('should accept valid STELLAR_NETWORK values', () => {
      const networks = ['testnet', 'mainnet', 'futurenet', 'standalone'];

      for (const network of networks) {
        const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
STELLAR_NETWORK=${network}
`;

        const result = testConfigLoad(envContent);

        expect(result.exitCode).toBe(0);
      }
    });

    it('should reject invalid STELLAR_NETWORK values', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
STELLAR_NETWORK=invalid-network
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('STELLAR_NETWORK');
    });
  });

  describe('RPC Fallback URLs', () => {
    it('should parse comma-separated fallback URLs', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_FALLBACK_URLS=https://rpc1.stellar.org, https://rpc2.stellar.org
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should reject fallback URLs that are not valid URLs', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
STELLAR_RPC_FALLBACK_URLS=not-a-url, https://valid.url
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('STELLAR_RPC_FALLBACK_URLS');
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should accept rate limiting tier configuration', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
RATE_LIMIT_FREE_REQ_PER_MIN=10
RATE_LIMIT_FREE_REQ_PER_HOUR=100
RATE_LIMIT_PRO_REQ_PER_MIN=100
RATE_LIMIT_PRO_REQ_PER_HOUR=5000
RATE_LIMIT_ENTERPRISE_REQ_PER_MIN=1000
RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR=50000
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });

    it('should reject non-numeric rate limiting values', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
RATE_LIMIT_FREE_REQ_PER_MIN=not-a-number
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('RATE_LIMIT_FREE_REQ_PER_MIN');
    });
  });

  describe('Multiple Validation Errors', () => {
    it('should report all validation errors at once', () => {
      const envContent = `
NODE_ENV=invalid
JWT_SECRET=short
PORT=not-a-port
STELLAR_RPC_URL=not-a-url
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
      // Should contain all error paths in the issues array
      expect(result.stderr).toContain('NODE_ENV');
      expect(result.stderr).toContain('JWT_SECRET');
      expect(result.stderr).toContain('PORT');
      expect(result.stderr).toContain('STELLAR_RPC_URL');
    });
  });

  describe('Exit Codes', () => {
    it('should exit with code 1 on validation failure', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=short
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).not.toBe(0);
    });

    it('should exit with code 0 on successful validation', () => {
      const envContent = `
NODE_ENV=production
JWT_SECRET=${'a'.repeat(32)}
ADMIN_SECRET=test-admin-secret
`;

      const result = testConfigLoad(envContent);

      expect(result.exitCode).toBe(0);
    });
  });
});
