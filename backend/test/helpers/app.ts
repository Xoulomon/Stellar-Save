/**
 * Builds a minimal Express app wired with the same routes as production
 * but without starting an HTTP server or background jobs.
 *
 * Import this in integration tests instead of the full index.ts entry point.
 */

import express from 'express';
import { PrismaClient } from '../src/generated/prisma/client';
import { AnalyticsService } from '../src/analytics_service';
import { RecommendationEngine } from '../src/recommendation';
import { ABTestingFramework } from '../src/ab_testing';
import { ExportService } from '../src/export_service';
import { BackupService, S3HttpClient } from '../src/backup_service';
import { BackupScheduler } from '../src/backup_scheduler';
import { RecoveryService } from '../src/recovery_service';
import { BackupMonitor } from '../src/backup_monitor';
import { ContractEventIndexer } from '../src/contract_event_indexer';
import { WebPushService } from '../src/web_push_service';
import { EmailService } from '../src/email_service';
import { createV1Router } from '../src/routes/v1';
import { getMemberReputation } from '../src/reputation_service';
import { Group, UserInteraction } from '../src/models';
import { format as fastCsvFormat } from 'fast-csv';
import { mockTransactions } from '../src/mock_data';

const mockGroups: Group[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

const mockInteractions: UserInteraction[] = [];

export function buildApp() {
  const app = express();
  app.use(express.json());

  const prisma = new PrismaClient();
  const analyticsService = new AnalyticsService(prisma);
  const emailService = new EmailService();
  const engine = new RecommendationEngine(mockGroups, mockInteractions);
  const abTest = new ABTestingFramework();
  const exportService = new ExportService(emailService, [], []);
  const s3Client = new S3HttpClient();
  const backupService = new BackupService(s3Client);
  const backupScheduler = new BackupScheduler(backupService);
  const recoveryService = new RecoveryService(backupService, s3Client);
  const backupMonitor = new BackupMonitor(backupService, {});
  const webPushService = new WebPushService();
  const eventIndexer = new ContractEventIndexer(
    'https://horizon-testnet.stellar.org',
    'CA_TEST',
    process.env.DATABASE_URL!,
    webPushService
  );

  const services = {
    engine,
    abTest,
    exportService,
    backupService,
    backupScheduler,
    recoveryService,
    backupMonitor,
    eventIndexer,
    analyticsService,
  };

  // /api/groups — mock data (no DB)
  app.get('/api/groups', (_req, res) => {
    res.json(mockGroups);
  });

  app.get('/api/groups/:id', (req, res) => {
    const group = mockGroups.find((g) => g.id === req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  });

  // /api/members
  app.get('/api/members/:address/reputation', async (req, res) => {
    const { address } = req.params;
    if (!address || address.trim().length === 0) {
      return res.status(400).json({ error: 'address is required' });
    }
    try {
      const reputation = await getMemberReputation(address.trim());
      return res.json(reputation);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch reputation' });
    }
  });

  app.get('/api/members/:address/export.csv', async (req, res) => {
    const { address } = req.params;
    const transactions = mockTransactions
      .filter((t) => t.memberAddress === address)
      .sort((a, b) => a.timestamp - b.timestamp);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(address)}-contributions-payouts.csv"`
    );

    const csvStream = fastCsvFormat({
      headers: ['date', 'group_id', 'type', 'amount', 'transaction_hash'],
    });
    csvStream.pipe(res);
    for (const t of transactions) {
      csvStream.write({
        date: new Date(t.timestamp).toISOString(),
        group_id: t.groupId,
        type: t.type,
        amount: t.amount,
        transaction_hash: t.stellarTxHash,
      });
    }
    csvStream.end();
  });

  // /api/v1/analytics/* — real DB-backed routes
  app.use('/api/v1', createV1Router(services));

  return { app, prisma };
}
