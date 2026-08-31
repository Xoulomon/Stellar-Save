import express from 'express';
import request from 'supertest';
import { createV1Router } from '../routes/v1';
import { createV2Router } from '../routes/v2';
import { readinessCheckCache } from '../redis';

// Mock the redis module
jest.mock('../redis', () => ({
  readinessCheckCache: jest.fn(),
}));

// Mock the dependencies passed to V1Services
const mockEventIndexer = {
  readinessCheckDatabase: jest.fn(),
  readinessCheckHorizon: jest.fn(),
} as any;

const mockServices = {
  engine: {} as any,
  exportService: {} as any,
  backupService: {} as any,
  backupScheduler: {} as any,
  forwardingService: {} as any,
  recoveryService: {} as any,
  backupMonitor: {} as any,
  backupRestoreDrill: {} as any,
  eventIndexer: mockEventIndexer,
  feedbackService: {} as any,
} as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', createV1Router(mockServices));
  app.use('/v2', createV2Router(mockServices));
  return app;
}

describe('Health and Readiness Endpoints', () => {
  const app = buildApp();
  const mockReadinessCheckCache = readinessCheckCache as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health (Liveness)', () => {
    it('returns 200 ok for v1', async () => {
      const res = await request(app).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ok',
        version: 'v1',
      });
    });

    it('returns 200 ok for v2 and includes uptime', async () => {
      const res = await request(app).get('/v2/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('v2');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.apiVersion).toBe('v2');
    });
  });

  describe('GET /ready (Readiness)', () => {
    it('returns 200 ready when all dependencies are up (v1)', async () => {
      mockEventIndexer.readinessCheckDatabase.mockResolvedValue({ up: true, latencyMs: 5 });
      mockEventIndexer.readinessCheckHorizon.mockResolvedValue({ up: true, latencyMs: 12 });
      mockReadinessCheckCache.mockResolvedValue({ up: true, latencyMs: 2 });

      const res = await request(app).get('/v1/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.dependencies).toEqual({
        database: { up: true, latencyMs: 5 },
        horizon: { up: true, latencyMs: 12 },
        cache: { up: true, latencyMs: 2 },
      });
    });

    it('returns 503 not_ready when DB is down', async () => {
      mockEventIndexer.readinessCheckDatabase.mockResolvedValue({ up: false, latencyMs: 2, error: 'DB connection timeout' });
      mockEventIndexer.readinessCheckHorizon.mockResolvedValue({ up: true, latencyMs: 10 });
      mockReadinessCheckCache.mockResolvedValue({ up: true, latencyMs: 1 });

      const res = await request(app).get('/v1/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.dependencies.database.up).toBe(false);
      expect(res.body.dependencies.database.error).toBe('DB connection timeout');
    });

    it('returns 503 not_ready when Cache/Redis is down', async () => {
      mockEventIndexer.readinessCheckDatabase.mockResolvedValue({ up: true, latencyMs: 5 });
      mockEventIndexer.readinessCheckHorizon.mockResolvedValue({ up: true, latencyMs: 10 });
      mockReadinessCheckCache.mockResolvedValue({ up: false, latencyMs: 1, error: 'Redis connection lost' });

      const res = await request(app).get('/v1/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.dependencies.cache.up).toBe(false);
      expect(res.body.dependencies.cache.error).toBe('Redis connection lost');
    });

    it('returns 503 not_ready when Horizon is down (v2)', async () => {
      mockEventIndexer.readinessCheckDatabase.mockResolvedValue({ up: true, latencyMs: 5 });
      mockEventIndexer.readinessCheckHorizon.mockResolvedValue({ up: false, latencyMs: 8, error: 'Horizon rate limited' });
      mockReadinessCheckCache.mockResolvedValue({ up: true, latencyMs: 1 });

      const res = await request(app).get('/v2/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.dependencies.horizon.up).toBe(false);
      expect(res.body.dependencies.horizon.error).toBe('Horizon rate limited');
      expect(res.body.apiVersion).toBe('v2');
    });
  });
});
