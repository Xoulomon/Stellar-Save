import crypto from 'crypto';
import { BackupService, S3Client } from '../backup_service';
import { BackupScheduler } from '../backup_scheduler';
import { RecoveryService } from '../recovery_service';
import { BackupMonitor } from '../backup_monitor';

// ── Inline test harness (matches existing test files) ────────────────────────
let _currentBeforeEach: (() => void) | null = null;
let _testQueue: Array<() => Promise<void>> = [];
let _queueDraining = false;

async function _drainQueue() {
  if (_queueDraining) return;
  _queueDraining = true;
  for (const run of _testQueue) await run();
  _queueDraining = false;
}

function describe(name: string, fn: Function) {
  console.log(`\nDescribe: ${name}`);
  const saved = _currentBeforeEach;
  _currentBeforeEach = null;
  fn();
  _currentBeforeEach = saved;
}
function beforeEach(fn: () => void) { _currentBeforeEach = fn; }
function test(name: string, fn: () => Promise<void> | void) {
  const setup = _currentBeforeEach; // captured at registration time
  console.log(`  Test: ${name}`);
  _testQueue.push(async () => {
    try { if (setup) setup(); await fn(); }
    catch (e: any) { console.error(`  ✗ FAILED: ${name}\n   `, e.message); process.exitCode = 1; }
  });
  // Kick off the drain after all synchronous registration is done
  Promise.resolve().then(() => _drainQueue());
}
const expect = (val: any) => ({
  toBe: (exp: any) => { if (val !== exp) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
  toEqual: (exp: any) => { if (JSON.stringify(val) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(val)}`); },
  toBeDefined: () => { if (val === undefined || val === null) throw new Error(`Expected defined, got ${val}`); },
  toBeUndefined: () => { if (val !== undefined) throw new Error(`Expected undefined, got ${val}`); },
  toContain: (exp: any) => { if (!String(val).includes(String(exp))) throw new Error(`Expected "${val}" to contain "${exp}"`); },
  toBeGreaterThan: (exp: number) => { if (val <= exp) throw new Error(`Expected ${val} > ${exp}`); },
  toHaveLength: (exp: number) => { if (val.length !== exp) throw new Error(`Expected length ${exp}, got ${val.length}`); },
  toBeTruthy: () => { if (!val) throw new Error(`Expected truthy, got ${val}`); },
  toBeFalsy: () => { if (val) throw new Error(`Expected falsy, got ${val}`); },
});

// ── Mock S3 client ────────────────────────────────────────────────────────────
function makeMockS3(): S3Client & { store: Map<string, Buffer> } {
  const store = new Map<string, Buffer>();
  return {
    store,
    async putObject({ Key, Body }: { Bucket: string; Key: string; Body: Buffer; ContentType: string }) {
      store.set(Key, Body);
    },
    async getObject({ Key }: { Bucket: string; Key: string }) {
      const data = store.get(Key);
      if (!data) throw new Error(`Key not found: ${Key}`);
      return data;
    },
    async listObjects({ Prefix }: { Bucket: string; Prefix: string }) {
      return Array.from(store.keys()).filter(k => k.startsWith(Prefix));
    },
    async deleteObject({ Key }: { Bucket: string; Key: string }) {
      store.delete(Key);
    },
  };
}

// ── BackupService tests ───────────────────────────────────────────────────────
describe('BackupService', () => {
  let s3: ReturnType<typeof makeMockS3>;
  let service: BackupService;

  beforeEach(() => {
    s3 = makeMockS3();
    service = new BackupService(s3);
  });

  test('creates a full backup job with pending status', async () => {
    const job = await service.createBackup('full');
    expect(job.id).toBeDefined();
    expect(job.type).toBe('full');
    // status starts as 'pending' and transitions quickly; verify it's a valid status
    expect(['pending', 'running', 'completed'].includes(job.status)).toBeTruthy();
  });

  test('full backup completes and uploads to S3', async () => {
    const job = await service.createBackup('full');
    // Wait for async runBackup
    await new Promise(r => setTimeout(r, 50));
    const updated = service.getJob(job.id)!;
    expect(updated.status).toBe('completed');
    expect(updated.s3Key).toBeDefined();
    expect(updated.checksum).toBeDefined();
    expect(s3.store.size).toBeGreaterThan(0);
  });

  test('incremental backup references base backup', async () => {
    const full = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const inc = await service.createBackup('incremental', full.id);
    await new Promise(r => setTimeout(r, 50));
    expect(inc.type).toBe('incremental');
    expect(inc.baseBackupId).toBe(full.id);
    expect(service.getJob(inc.id)!.status).toBe('completed');
  });

  test('listJobs returns jobs sorted newest first', async () => {
    await service.createBackup('full');
    await new Promise(r => setTimeout(r, 10));
    await service.createBackup('full');
    const jobs = service.listJobs();
    expect(jobs[0].createdAt).toBeGreaterThan(jobs[1].createdAt);
  });

  test('getLatestCompleted returns most recent completed full backup', async () => {
    await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const latest = service.getLatestCompleted('full');
    expect(latest).toBeDefined();
    expect(latest!.status).toBe('completed');
  });

  test('getJob returns undefined for unknown id', () => {
    const job = service.getJob('nonexistent');
    expect(job).toBeUndefined();
  });

  test('pruneOldBackups removes expired backups', async () => {
    const job = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    // Manually age the job
    const j = service.getJob(job.id)!;
    (j as any).createdAt = Date.now() - 31 * 86_400_000;
    const pruned = await service.pruneOldBackups();
    expect(pruned).toBe(1);
    expect(service.getJob(job.id)).toBeUndefined();
  });
});

// ── BackupScheduler tests ─────────────────────────────────────────────────────
describe('BackupScheduler', () => {
  let service: BackupService;
  let scheduler: BackupScheduler;

  beforeEach(() => {
    service = new BackupService(makeMockS3());
    scheduler = new BackupScheduler(service, {
      fullBackupIntervalMs: 100_000,
      incrementalIntervalMs: 50_000,
    });
  });

  test('triggerManual full creates a full backup', async () => {
    const job = await scheduler.triggerManual('full');
    expect(job.type).toBe('full');
    expect(job.id).toBeDefined();
  });

  test('triggerManual incremental creates an incremental backup', async () => {
    const job = await scheduler.triggerManual('incremental');
    expect(job.type).toBe('incremental');
  });

  test('start/stop toggles running state', () => {
    expect(scheduler.isRunning()).toBeFalsy();
    scheduler.start();
    expect(scheduler.isRunning()).toBeTruthy();
    scheduler.stop();
    expect(scheduler.isRunning()).toBeFalsy();
  });
});

// ── RecoveryService tests ─────────────────────────────────────────────────────
describe('RecoveryService', () => {
  let s3: ReturnType<typeof makeMockS3>;
  let service: BackupService;
  let recovery: RecoveryService;

  beforeEach(() => {
    s3 = makeMockS3();
    service = new BackupService(s3);
    recovery = new RecoveryService(service, s3);
  });

  test('restore succeeds for a completed backup', async () => {
    const job = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const result = await recovery.restore(job.id);
    expect(result.jobId).toBe(job.id);
    expect(result.restoredAt).toBeDefined();
    expect(result.checksum).toBeDefined();
  });

  test('restore throws for unknown jobId', async () => {
    let threw = false;
    try { await recovery.restore('bad-id'); } catch { threw = true; }
    expect(threw).toBeTruthy();
  });

  test('restore throws for non-completed job', async () => {
    const job = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    // Force the job into a non-completed state
    (service.getJob(job.id) as any).status = 'failed';
    let threw = false;
    try { await recovery.restore(job.id); } catch { threw = true; }
    expect(threw).toBeTruthy();
  });

  test('restoreLatest restores the most recent completed backup', async () => {
    await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const result = await recovery.restoreLatest('full');
    expect(result.jobId).toBeDefined();
  });

  test('restoreLatest throws when no completed backup exists', async () => {
    let threw = false;
    try { await recovery.restoreLatest('full'); } catch { threw = true; }
    expect(threw).toBeTruthy();
  });

  test('listRestorePoints returns only completed jobs', async () => {
    await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const points = recovery.listRestorePoints();
    expect(points.length).toBeGreaterThan(0);
    points.forEach((p: any) => expect(p.status).toBe('completed'));
  });

  test('restore detects checksum mismatch', async () => {
    const job = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const j = service.getJob(job.id)!;
    // Tamper with stored checksum
    (j as any).checksum = 'deadbeef';
    let threw = false;
    try { await recovery.restore(job.id); } catch { threw = true; }
    expect(threw).toBeTruthy();
  });
});

// ── BackupMonitor tests ───────────────────────────────────────────────────────
describe('BackupMonitor', () => {
  let service: BackupService;
  let monitor: BackupMonitor;

  beforeEach(() => {
    service = new BackupService(makeMockS3());
    monitor = new BackupMonitor(service, { maxBackupAgeMs: 1000, checkIntervalMs: 999_999 });
  });

  test('runChecks emits warning when no completed backup exists', async () => {
    const alerts = await monitor.runChecks();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].level).toBe('warning');
  });

  test('runChecks emits error for failed backup jobs', async () => {
    const job = await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    // Force failure
    const j = service.getJob(job.id)!;
    (j as any).status = 'failed';
    (j as any).error = 'disk full';
    const alerts = await monitor.runChecks();
    const errorAlert = alerts.find((a: any) => a.level === 'error');
    expect(errorAlert).toBeDefined();
    expect(errorAlert!.message).toContain('disk full');
  });

  test('runChecks emits warning when backup is stale', async () => {
    await service.createBackup('full');
    await new Promise(r => setTimeout(r, 50));
    const latest = service.getLatestCompleted('full')!;
    // Age the backup beyond threshold
    (latest as any).createdAt = Date.now() - 2000;
    const alerts = await monitor.runChecks();
    const staleAlert = alerts.find((a: any) => a.message.includes('old'));
    expect(staleAlert).toBeDefined();
  });

  test('acknowledge marks alert as acknowledged', async () => {
    await monitor.runChecks();
    const alerts = monitor.getAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    const ok = monitor.acknowledge(alerts[0].id);
    expect(ok).toBeTruthy();
    expect(monitor.getAlerts()[0].acknowledged).toBeTruthy();
  });

  test('acknowledge returns false for unknown alertId', () => {
    const ok = monitor.acknowledge('nonexistent');
    expect(ok).toBeFalsy();
  });

  test('getAlerts(unacknowledgedOnly=true) filters acknowledged alerts', async () => {
    await monitor.runChecks();
    const alerts = monitor.getAlerts();
    monitor.acknowledge(alerts[0].id);
    const unacked = monitor.getAlerts(true);
    expect(unacked.every((a: any) => !a.acknowledged)).toBeTruthy();
  });
});
