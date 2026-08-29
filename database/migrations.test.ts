/**
 * Migration Rollback Integration Tests
 * Issue #1557: Verify all database migrations can roll back cleanly
 * 
 * These tests ensure that:
 * 1. Each migration can be applied successfully
 * 2. Each migration can be rolled back cleanly
 * 3. Rollback leaves the database in the expected state
 * 4. All migrations have valid down migrations
 * 
 * Prerequisites:
 * - PostgreSQL test database running (see docker-compose.test.yml)
 * - TEST_DATABASE_URL environment variable set
 * 
 * Usage:
 *   npm test -- database/migrations.test.ts
 */

import { Client } from 'pg';
import { promises as fs } from 'fs';
import * as path from 'path';

// Test configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 
  'postgresql://postgres:postgres@localhost:5433/stellar_save_test';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Database client
let client: Client;

/**
 * Get all migration files (excluding template and .down files)
 */
async function getMigrationFiles(): Promise<string[]> {
  const files = await fs.readdir(MIGRATIONS_DIR);
  
  return files
    .filter(file => 
      file.endsWith('.sql') && 
      !file.includes('.down.sql') && 
      file !== '000_template.sql'
    )
    .sort();
}

/**
 * Check if a migration has a corresponding down file
 */
async function getDownMigration(upFile: string): Promise<string | null> {
  const downFile = upFile.replace('.sql', '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFile);
  
  try {
    await fs.access(downPath);
    return downFile;
  } catch {
    return null;
  }
}

/**
 * Execute SQL file
 */
async function executeSqlFile(filename: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = await fs.readFile(filePath, 'utf-8');
  
  await client.query(sql);
}

/**
 * Check if a table exists
 */
async function tableExists(tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  
  return result.rows[0].exists;
}

/**
 * Check if an index exists
 */
async function indexExists(indexName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname = $1
    )`,
    [indexName]
  );
  
  return result.rows[0].exists;
}

/**
 * Get all tables in the database
 */
async function getTables(): Promise<string[]> {
  const result = await client.query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     ORDER BY table_name`
  );
  
  return result.rows.map(row => row.table_name);
}

/**
 * Get all indexes for a table
 */
async function getIndexes(tableName: string): Promise<string[]> {
  const result = await client.query(
    `SELECT indexname 
     FROM pg_indexes 
     WHERE schemaname = 'public' 
     AND tablename = $1 
     ORDER BY indexname`,
    [tableName]
  );
  
  return result.rows.map(row => row.indexname);
}

/**
 * Clean up database (drop all tables)
 */
async function cleanupDatabase(): Promise<void> {
  // Drop all tables in the public schema
  await client.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
  `);
}

// ==============================================================================
// Test Suite
// ==============================================================================

describe('Database Migration Rollback Tests (Issue #1557)', () => {
  
  beforeAll(async () => {
    // Connect to test database
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
  });

  afterAll(async () => {
    // Disconnect from database
    await client.end();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase();
  });

  describe('Migration Files', () => {
    it('should have at least one migration file', async () => {
      const migrations = await getMigrationFiles();
      expect(migrations.length).toBeGreaterThan(0);
    });

    it('should have down migrations for all migrations', async () => {
      const migrations = await getMigrationFiles();
      
      for (const migration of migrations) {
        const downMigration = await getDownMigration(migration);
        expect(downMigration).not.toBeNull();
        expect(downMigration).toBe(migration.replace('.sql', '.down.sql'));
      }
    });

    it('should have properly named migration files', async () => {
      const migrations = await getMigrationFiles();
      const namePattern = /^\d{3}_[a-z_]+\.sql$/;
      
      for (const migration of migrations) {
        expect(migration).toMatch(namePattern);
      }
    });
  });

  describe('Migration 001: Create Events Table', () => {
    const MIGRATION_UP = '001_create_events_table.sql';
    const MIGRATION_DOWN = '001_create_events_table.down.sql';

    it('should apply migration successfully', async () => {
      await executeSqlFile(MIGRATION_UP);
      
      // Verify table was created
      expect(await tableExists('events')).toBe(true);
      
      // Verify indexes were created
      expect(await indexExists('idx_events_cycle_analytics')).toBe(true);
      expect(await indexExists('idx_events_member_history')).toBe(true);
    });

    it('should rollback migration successfully', async () => {
      // Apply migration
      await executeSqlFile(MIGRATION_UP);
      expect(await tableExists('events')).toBe(true);
      
      // Rollback migration
      await executeSqlFile(MIGRATION_DOWN);
      
      // Verify table was dropped
      expect(await tableExists('events')).toBe(false);
      
      // Verify indexes were dropped
      expect(await indexExists('idx_events_cycle_analytics')).toBe(false);
      expect(await indexExists('idx_events_member_history')).toBe(false);
    });

    it('should be idempotent (safe to apply multiple times)', async () => {
      await executeSqlFile(MIGRATION_UP);
      await executeSqlFile(MIGRATION_UP); // Apply again
      
      expect(await tableExists('events')).toBe(true);
    });

    it('should create correct table structure', async () => {
      await executeSqlFile(MIGRATION_UP);
      
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'events'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows;
      
      // Verify key columns exist
      expect(columns.find(c => c.column_name === 'id')).toBeDefined();
      expect(columns.find(c => c.column_name === 'group_id')).toBeDefined();
      expect(columns.find(c => c.column_name === 'member_address')).toBeDefined();
      expect(columns.find(c => c.column_name === 'event_type')).toBeDefined();
      expect(columns.find(c => c.column_name === 'transaction_hash')).toBeDefined();
      expect(columns.find(c => c.column_name === 'ledger_sequence')).toBeDefined();
    });
  });

  describe('Migration 002: Add Missing Indexes', () => {
    const MIGRATION_001_UP = '001_create_events_table.sql';
    const MIGRATION_002_UP = '002_add_missing_indexes.sql';
    const MIGRATION_002_DOWN = '002_add_missing_indexes.down.sql';

    beforeEach(async () => {
      // Apply migration 001 first (dependency)
      await executeSqlFile(MIGRATION_001_UP);
    });

    it('should apply migration successfully', async () => {
      await executeSqlFile(MIGRATION_002_UP);
      
      // Verify all four indexes were created
      expect(await indexExists('idx_events_transaction_hash')).toBe(true);
      expect(await indexExists('idx_events_ledger_sequence')).toBe(true);
      expect(await indexExists('idx_events_group_cycle')).toBe(true);
      expect(await indexExists('idx_events_type_created')).toBe(true);
    });

    it('should rollback migration successfully', async () => {
      // Apply migration
      await executeSqlFile(MIGRATION_002_UP);
      expect(await indexExists('idx_events_transaction_hash')).toBe(true);
      
      // Rollback migration
      await executeSqlFile(MIGRATION_002_DOWN);
      
      // Verify indexes were dropped
      expect(await indexExists('idx_events_transaction_hash')).toBe(false);
      expect(await indexExists('idx_events_ledger_sequence')).toBe(false);
      expect(await indexExists('idx_events_group_cycle')).toBe(false);
      expect(await indexExists('idx_events_type_created')).toBe(false);
      
      // Verify original table and indexes from 001 still exist
      expect(await tableExists('events')).toBe(true);
      expect(await indexExists('idx_events_cycle_analytics')).toBe(true);
      expect(await indexExists('idx_events_member_history')).toBe(true);
    });

    it('should be idempotent (safe to apply multiple times)', async () => {
      await executeSqlFile(MIGRATION_002_UP);
      await executeSqlFile(MIGRATION_002_UP); // Apply again
      
      expect(await indexExists('idx_events_transaction_hash')).toBe(true);
    });

    it('should not affect existing data', async () => {
      // Insert test data
      await client.query(`
        INSERT INTO events (group_id, member_address, event_type, ledger_sequence, transaction_hash)
        VALUES (1, 'GTEST123', 'ContributionMade', 12345, 'abc123')
      `);
      
      // Apply migration
      await executeSqlFile(MIGRATION_002_UP);
      
      // Verify data still exists
      const result = await client.query('SELECT COUNT(*) FROM events');
      expect(parseInt(result.rows[0].count)).toBe(1);
      
      // Rollback migration
      await executeSqlFile(MIGRATION_002_DOWN);
      
      // Verify data still exists after rollback
      const resultAfter = await client.query('SELECT COUNT(*) FROM events');
      expect(parseInt(resultAfter.rows[0].count)).toBe(1);
    });
  });

  describe('Full Migration Cycle', () => {
    it('should apply all migrations in order', async () => {
      const migrations = await getMigrationFiles();
      
      for (const migration of migrations) {
        await executeSqlFile(migration);
      }
      
      // Verify final state
      expect(await tableExists('events')).toBe(true);
      
      // Verify all indexes exist
      const allIndexes = await getIndexes('events');
      expect(allIndexes.length).toBeGreaterThan(0);
    });

    it('should rollback all migrations in reverse order', async () => {
      const migrations = await getMigrationFiles();
      
      // Apply all migrations
      for (const migration of migrations) {
        await executeSqlFile(migration);
      }
      
      // Rollback all migrations in reverse order
      for (let i = migrations.length - 1; i >= 0; i--) {
        const downMigration = await getDownMigration(migrations[i]);
        if (downMigration) {
          await executeSqlFile(downMigration);
        }
      }
      
      // Verify clean state
      const tables = await getTables();
      expect(tables.length).toBe(0);
    });

    it('should handle apply → rollback → reapply cycle', async () => {
      const migrations = await getMigrationFiles();
      
      // Apply all
      for (const migration of migrations) {
        await executeSqlFile(migration);
      }
      
      // Rollback all
      for (let i = migrations.length - 1; i >= 0; i--) {
        const downMigration = await getDownMigration(migrations[i]);
        if (downMigration) {
          await executeSqlFile(downMigration);
        }
      }
      
      // Reapply all
      for (const migration of migrations) {
        await executeSqlFile(migration);
      }
      
      // Verify final state matches initial apply
      expect(await tableExists('events')).toBe(true);
    });
  });
});
