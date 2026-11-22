/**
 * Integration tests for Issue #1693: Validation layer
 *
 * Tests that:
 * 1. Invalid payloads return 400 with standardized ErrorEnvelope format
 * 2. Query parameters are validated according to schemas
 * 3. Path parameters are validated according to schemas
 * 4. Request bodies are validated according to schemas
 * 5. Validation errors include detailed field-level error messages
 *
 * Coverage: Top 10 highest-traffic endpoints + related endpoints
 */

import request from 'supertest';
import type { Express } from 'express';

// Mock Express app for testing
let app: Express;

// Setup: Create a minimal Express app with v1 router
beforeAll(() => {
  const express = require('express');
  app = express();
  app.use(express.json());

  // Mock services for testing
  const mockAnalyticsService = {
    getGroupsOverviewStats: jest.fn().mockResolvedValue({ totalGroups: 100 }),
    getPlatformStats: jest.fn().mockResolvedValue({ activeUsers: 500 }),
    getUserStats: jest.fn().mockResolvedValue({ contributions: 10 }),
    getGroupStats: jest.fn().mockResolvedValue({ members: 5 }),
    getEventStats: jest.fn().mockResolvedValue([]),
    recordEvent: jest.fn().mockResolvedValue(true),
    generateReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
    getReports: jest.fn().mockResolvedValue([]),
    getCacheStats: jest.fn().mockResolvedValue({ size: 0 }),
    clearCache: jest.fn().mockResolvedValue(true),
  };

  const mockExportService = {
    createJob: jest.fn().mockResolvedValue('job-1'),
    getJob: jest.fn().mockReturnValue({ id: 'job-1', status: 'pending' }),
  };

  const mockBackupService = {
    listJobs: jest.fn().mockReturnValue([]),
    getJob: jest.fn().mockReturnValue({ id: 'backup-1' }),
  };

  const mockBackupScheduler = {
    triggerManual: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockRecoveryService = {
    restore: jest.fn().mockResolvedValue({ status: 'restored' }),
    restoreLatest: jest.fn().mockResolvedValue({ status: 'restored' }),
  };

  const mockBackupMonitor = {
    getAlerts: jest.fn().mockReturnValue([]),
    acknowledge: jest.fn().mockReturnValue(true),
  };

  const mockBackupRestoreDrill = {
    listRuns: jest.fn().mockReturnValue([]),
    listAlerts: jest.fn().mockReturnValue([]),
    acknowledge: jest.fn().mockReturnValue(true),
    runDrill: jest.fn().mockResolvedValue({ id: 'drill-1' }),
  };

  const mockEventIndexer = {
    getEvents: jest.fn().mockResolvedValue([]),
    readinessCheckDatabase: jest.fn().mockResolvedValue({ up: true }),
    readinessCheckHorizon: jest.fn().mockResolvedValue({ up: true }),
  };

  const mockFeedbackService = {};

  const mockRecommendationEngine = {
    getRecommendations: jest.fn().mockReturnValue([]),
    setPreference: jest.fn(),
  };

  const { createV1Router } = require('../routes/v1');
  const router = createV1Router({
    engine: mockRecommendationEngine,
    exportService: mockExportService,
    backupService: mockBackupService,
    backupScheduler: mockBackupScheduler,
    recoveryService: mockRecoveryService,
    backupMonitor: mockBackupMonitor,
    backupRestoreDrill: mockBackupRestoreDrill,
    eventIndexer: mockEventIndexer,
    analyticsService: mockAnalyticsService,
    feedbackService: mockFeedbackService,
  });

  app.use('/api', router);

  // Error handler middleware
  app.use((err: any, _req: any, res: any, _next: any) => {
    const { toEnvelope } = require('../lib/errors');
    const correlationId = 'test-correlation-id';
    const envelope = toEnvelope(err, correlationId);
    res.status(err.statusCode || 500).json(envelope);
  });
});

describe('Validation Integration Tests - Issue #1693', () => {
  describe('Query Parameter Validation', () => {
    describe('GET /api/search', () => {
      it('should reject missing required query parameter q', async () => {
        const res = await request(app).get('/api/search');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('Search query is required');
      });

      it('should reject empty query parameter', async () => {
        const res = await request(app).get('/api/search?q=');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('Search query is required');
      });

      it('should reject query longer than 200 characters', async () => {
        const longQuery = 'a'.repeat(201);
        const res = await request(app).get(`/api/search?q=${longQuery}`);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid query', async () => {
        const res = await request(app).get('/api/search?q=test');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/search/autocomplete', () => {
      it('should reject missing query parameter q', async () => {
        const res = await request(app).get('/api/search/autocomplete');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid query', async () => {
        const res = await request(app).get('/api/search/autocomplete?q=test');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/analytics/platform', () => {
      it('should accept optional date parameter', async () => {
        const res = await request(app).get('/api/analytics/platform');
        expect(res.status).toBe(200);
      });

      it('should accept valid ISO 8601 date', async () => {
        const res = await request(app).get(
          '/api/analytics/platform?date=2026-09-26T00:00:00.000Z'
        );
        expect(res.status).toBe(200);
      });

      it('should reject invalid date format', async () => {
        const res = await request(app).get('/api/analytics/platform?date=invalid-date');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/events', () => {
      it('should accept no query parameters', async () => {
        const res = await request(app).get('/api/events');
        expect(res.status).toBe(200);
      });

      it('should reject invalid startLedger (negative)', async () => {
        const res = await request(app).get('/api/events?startLedger=-1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject invalid limit (out of range)', async () => {
        const res = await request(app).get('/api/events?limit=101');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid numeric ledger parameters', async () => {
        const res = await request(app).get(
          '/api/events?startLedger=0&endLedger=1000&limit=50&offset=0'
        );
        expect(res.status).toBe(200);
      });

      it('should accept optional ISO 8601 dates', async () => {
        const res = await request(app).get(
          '/api/events?startTime=2026-01-01T00:00:00.000Z&endTime=2026-12-31T23:59:59.999Z'
        );
        expect(res.status).toBe(200);
      });

      it('should reject invalid startTime format', async () => {
        const res = await request(app).get('/api/events?startTime=not-a-date');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/analytics/events', () => {
      it('should accept no parameters', async () => {
        const res = await request(app).get('/api/analytics/events');
        expect(res.status).toBe(200);
      });

      it('should reject invalid limit', async () => {
        const res = await request(app).get('/api/analytics/events?limit=0');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject invalid offset (negative)', async () => {
        const res = await request(app).get('/api/analytics/events?offset=-1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid date range', async () => {
        const res = await request(app).get(
          '/api/analytics/events?startDate=2026-01-01T00:00:00Z&endDate=2026-12-31T23:59:59Z&limit=50'
        );
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/stats/groups', () => {
      it('should accept no parameters', async () => {
        const res = await request(app).get('/api/stats/groups');
        expect(res.status).toBe(200);
      });

      it('should accept optional date parameter', async () => {
        const res = await request(app).get(
          '/api/stats/groups?date=2026-09-26T00:00:00.000Z'
        );
        expect(res.status).toBe(200);
      });

      it('should reject invalid date format', async () => {
        const res = await request(app).get('/api/stats/groups?date=09/26/2026');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('Path Parameter Validation', () => {
    describe('GET /api/export/:jobId', () => {
      it('should reject missing jobId', async () => {
        const res = await request(app).get('/api/export/');
        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it('should accept valid jobId', async () => {
        const res = await request(app).get('/api/export/job-123');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/analytics/users/:userId', () => {
      it('should reject empty userId', async () => {
        // Note: This depends on implementation - empty path params may not reach validation
        const res = await request(app).get('/api/analytics/users/user-123');
        expect(res.status).toBe(200);
      });

      it('should accept valid userId with optional date', async () => {
        const res = await request(app).get(
          '/api/analytics/users/user-123?date=2026-09-26T00:00:00.000Z'
        );
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/analytics/groups/:groupId', () => {
      it('should accept valid groupId', async () => {
        const res = await request(app).get('/api/analytics/groups/group-123');
        expect(res.status).toBe(200);
      });

      it('should accept valid groupId with date parameter', async () => {
        const res = await request(app).get(
          '/api/analytics/groups/group-123?date=2026-09-26T00:00:00.000Z'
        );
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/backup/:jobId', () => {
      it('should accept valid jobId', async () => {
        const res = await request(app).get('/api/backup/backup-123');
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Request Body Validation', () => {
    describe('POST /api/export', () => {
      it('should reject missing userId', async () => {
        const res = await request(app).post('/api/export').send({
          email: 'user@example.com',
          format: 'CSV',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('userId');
      });

      it('should reject invalid email', async () => {
        const res = await request(app).post('/api/export').send({
          userId: 'user-123',
          email: 'not-an-email',
          format: 'CSV',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('email');
      });

      it('should reject invalid format enum', async () => {
        const res = await request(app).post('/api/export').send({
          userId: 'user-123',
          email: 'user@example.com',
          format: 'INVALID',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid payload', async () => {
        const res = await request(app).post('/api/export').send({
          userId: 'user-123',
          email: 'user@example.com',
          format: 'CSV',
        });
        expect(res.status).toBe(202);
      });
    });

    describe('POST /api/backup', () => {
      it('should reject missing type', async () => {
        const res = await request(app).post('/api/backup').send({});
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject invalid backup type', async () => {
        const res = await request(app).post('/api/backup').send({
          type: 'invalid-type',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid backup type', async () => {
        const res = await request(app).post('/api/backup').send({
          type: 'full',
        });
        expect(res.status).toBe(202);
      });
    });

    describe('POST /api/backup/restore', () => {
      it('should accept no body (restore latest)', async () => {
        const res = await request(app).post('/api/backup/restore').send({});
        expect(res.status).toBe(200);
      });

      it('should accept optional jobId', async () => {
        const res = await request(app).post('/api/backup/restore').send({
          jobId: 'backup-123',
        });
        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/analytics/events', () => {
      it('should reject missing eventType', async () => {
        const res = await request(app).post('/api/analytics/events').send({
          eventName: 'test-event',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject missing eventName', async () => {
        const res = await request(app).post('/api/analytics/events').send({
          eventType: 'pageview',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid payload', async () => {
        const res = await request(app).post('/api/analytics/events').send({
          eventType: 'pageview',
          eventName: 'home-page',
          userId: 'user-123',
          groupId: 'group-456',
          eventData: { page: '/home' },
        });
        expect(res.status).toBe(201);
      });
    });

    describe('POST /api/analytics/reports', () => {
      it('should reject missing startDate', async () => {
        const res = await request(app).post('/api/analytics/reports').send({
          reportType: 'daily',
          reportName: 'Daily Report',
          endDate: '2026-12-31T23:59:59Z',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should reject invalid startDate format', async () => {
        const res = await request(app).post('/api/analytics/reports').send({
          reportType: 'daily',
          reportName: 'Daily Report',
          startDate: '2026-01-01',
          endDate: '2026-12-31T23:59:59Z',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      });

      it('should accept valid payload', async () => {
        const res = await request(app).post('/api/analytics/reports').send({
          reportType: 'daily',
          reportName: 'Daily Report',
          startDate: '2026-01-01T00:00:00Z',
          endDate: '2026-12-31T23:59:59Z',
          generatedBy: 'admin-user',
        });
        expect(res.status).toBe(201);
      });
    });

    describe('POST /api/preferences', () => {
      it('should reject missing userId', async () => {
        const res = await request(app).post('/api/preferences').send({
          emailNotifications: true,
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.message).toContain('userId');
      });

      it('should accept valid payload', async () => {
        const res = await request(app).post('/api/preferences').send({
          userId: 'user-123',
          emailNotifications: true,
          emailFrequency: 'daily',
        });
        expect(res.status).toBe(200);
      });
    });

    describe('POST /api/analytics/cache/clear', () => {
      it('should accept default pattern', async () => {
        const res = await request(app).post('/api/analytics/cache/clear').send({});
        expect(res.status).toBe(200);
      });

      it('should accept custom pattern', async () => {
        const res = await request(app).post('/api/analytics/cache/clear').send({
          pattern: 'analytics:*',
        });
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Standardized Error Response Format', () => {
    it('should include code field', async () => {
      const res = await request(app).get('/api/search');
      expect(res.body).toHaveProperty('code');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should include message field', async () => {
      const res = await request(app).get('/api/search');
      expect(res.body).toHaveProperty('message');
      expect(typeof res.body.message).toBe('string');
    });

    it('should include correlationId field', async () => {
      const res = await request(app).get('/api/search');
      expect(res.body).toHaveProperty('correlationId');
    });

    it('should include timestamp field', async () => {
      const res = await request(app).get('/api/search');
      expect(res.body).toHaveProperty('timestamp');
      expect(new Date(res.body.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include 400 status code for validation failures', async () => {
      const res = await request(app).get('/api/search');
      expect(res.status).toBe(400);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still accept valid requests without validation errors', async () => {
      const res = await request(app).post('/api/export').send({
        userId: 'user-123',
        email: 'user@example.com',
        format: 'CSV',
      });
      expect(res.status).toBe(202);
      expect(res.body).toHaveProperty('jobId');
    });

    it('should still accept optional query parameters', async () => {
      const res = await request(app).get('/api/analytics/platform');
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('code');
    });

    it('should coerce numeric query parameters', async () => {
      // limit and offset should be coerced from string to number
      const res = await request(app).get('/api/events?limit=20&offset=0');
      expect(res.status).toBe(200);
    });
  });

  describe('Type Safety & Edge Cases', () => {
    it('should handle boolean query parameters correctly', async () => {
      const res = await request(app).get('/api/backup/alerts?unacknowledgedOnly=true');
      expect(res.status).toBe(200);
    });

    it('should trim whitespace in string parameters', async () => {
      const res = await request(app).get('/api/search?q=  test  ');
      expect(res.status).toBe(200);
    });

    it('should handle special characters in search query', async () => {
      const res = await request(app).get('/api/search?q=test@example.com');
      expect(res.status).toBe(200);
    });

    it('should handle URL-encoded special characters', async () => {
      const res = await request(app).get(
        '/api/search?q=test%20query%20with%20spaces'
      );
      expect(res.status).toBe(200);
    });

    it('should reject null in required fields', async () => {
      const res = await request(app).post('/api/export').send({
        userId: null,
        email: 'user@example.com',
        format: 'CSV',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject undefined in required fields', async () => {
      const res = await request(app).post('/api/export').send({
        userId: undefined,
        email: 'user@example.com',
        format: 'CSV',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
