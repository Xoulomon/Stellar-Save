/**
 * Integration tests for the IPFS upload/retrieval service.
 *
 * Covers:
 *   - Upload (/api/v0/add) through the real IpfsClient
 *   - Retrieval (/api/v0/cat) round-trip
 *   - Pin lifecycle (pinAdd / pinLs / pinRm)
 *   - Failure handling when the IPFS node returns errors
 *   - Retry path (#44) in the pinning queue processor
 *
 * Uses an in-process IPFS HTTP RPC test double (test/helpers/ipfs-test-node.ts)
 * so no real IPFS daemon is required, and an in-memory Redis double
 * (test/helpers/in-memory-redis.ts) since no Redis is available in the
 * integration environment.
 */

import { IpfsClient } from '../../src/ipfs/client';
import { PinningService } from '../../src/ipfs/pinning_service';
import { PinningQueue } from '../../src/ipfs/pinning_queue';
import { IpfsTestNode } from '../helpers/ipfs-test-node';
import { InMemoryRedis } from '../helpers/in-memory-redis';

const mockRedis = new InMemoryRedis();

jest.mock('../../src/redis', () => ({
  __esModule: true,
  default: mockRedis,
}));

describe('IPFS upload/retrieval service (integration)', () => {
  let ipfsNode: IpfsTestNode;
  let client: IpfsClient;
  let pinning: PinningService;

  beforeAll(async () => {
    ipfsNode = new IpfsTestNode();
    const port = await ipfsNode.start();
    client = new IpfsClient(ipfsNode.baseUrl, 5000);
  });

  afterAll(async () => {
    await ipfsNode.close();
  });

  beforeEach(() => {
    mockRedis.reset();
    ipfsNode.setErrorMode(false);
    pinning = new PinningService(client);
  });

  describe('upload (add)', () => {
    it('uploads content and returns a deterministic CID + size', async () => {
      const result = await client.add('{"hello":"world"}', 'group-123-metadata.json');
      expect(result.cid).toMatch(/^QmTest/);
      expect(result.size).toBeGreaterThan(0);
      expect(result.size).toBe(17);
      expect(ipfsNode.hasBlock(result.cid)).toBe(true);
    });

    it('uploads binary Buffer data', async () => {
      const data = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      const result = await client.add(data, 'binary.bin');
      expect(ipfsNode.hasBlock(result.cid)).toBe(true);
      expect(result.size).toBe(data.length);
    });

    it('uses different CIDs for different content', async () => {
      const a = await client.add('alpha');
      const b = await client.add('beta');
      expect(a.cid).not.toBe(b.cid);
    });
  });

  describe('retrieval (cat)', () => {
    it('round-trips uploaded content', async () => {
      const content = JSON.stringify({
        name: 'Weekly Savers',
        description: 'Round trip test',
        version: 2,
      });
      const { cid } = await client.add(content, 'group-42-metadata.json');
      const retrieved = await client.cat(cid);
      expect(retrieved).toBe(content);
    });

    it('retrieves binary content unchanged', async () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const { cid } = await client.add(binary, 'payload.bin');
      const retrieved = await client.cat(cid);
      expect(Buffer.from(retrieved, 'latin1').equals(binary)).toBe(true);
    });

    it('throws for an unknown CID', async () => {
      await expect(client.cat('QmTestMissing00000000')).rejects.toThrow(/block not found/);
    });
  });

  describe('pin lifecycle (pinAdd / pinLs / pinRm)', () => {
    let cid: string;

    beforeEach(async () => {
      cid = (await client.add('pinnable-content')).cid;
    });

    it('pins and lists a CID', async () => {
      const pin = await client.pinAdd(cid);
      expect(pin.cid).toBe(cid);
      expect(pin.pinned).toBe(true);

      const pins = await client.pinLs(cid);
      expect(pins.some((p) => p.cid === cid)).toBe(true);
    });

    it('unpins a CID', async () => {
      await client.pinAdd(cid);
      const rm = await client.pinRm(cid);
      expect(rm.pinned).toBe(false);
      const pins = await client.pinLs(cid);
      expect(pins.some((p) => p.cid === cid)).toBe(false);
    });

    it('lists all pins including their type', async () => {
      await client.pinAdd(cid);
      const pins = await client.pinLs();
      const match = pins.find((p) => p.cid === cid);
      expect(match).toBeDefined();
      expect(['direct', 'recursive', 'indirect']).toContain(match!.type);
    });
  });

  describe('id / health check', () => {
    it('returns node identity', async () => {
      const info = await client.id();
      expect(info.id).toMatch(/^QmTestNodeId/);
    });

    it('healthCheck returns true when the node is reachable', async () => {
      expect(await client.healthCheck()).toBe(true);
    });

    it('healthCheck returns false when the node is unreachable', async () => {
      const deadClient = new IpfsClient('http://127.0.0.1:1', 500);
      expect(await deadClient.healthCheck()).toBe(false);
    });
  });

  describe('failure handling', () => {
    it('throws when the node returns an error on pin add', async () => {
      const cid = (await client.add('content')).cid;
      ipfsNode.setErrorMode(true);
      await expect(client.pinAdd(cid)).rejects.toThrow(/IPFS API error 500/);
    });

    it('throws when the node returns an error on upload', async () => {
      ipfsNode.setErrorMode(true);
      await expect(client.add('data')).rejects.toThrow(/IPFS API error 500/);
    });

    it('reports node as unhealthy when errored', async () => {
      ipfsNode.setErrorMode(true);
      expect(await client.healthCheck()).toBe(false);
    });
  });

  describe('retry path (#44)', () => {
    it('marks a failed pin job and retries it back to success', async () => {
      const cid = (await client.add('retry-me')).cid;
      const groupId = 'grp-retry';
      const contractId = 'crt-retry';

      const job = await pinning.pinContent(cid, groupId, contractId);
      expect(job.status).toBe('queued');

      // First processing attempt fails (pin operation errors while the node
      // remains healthy for /id), job is marked failed.
      ipfsNode.failEndpoint('pin_add');
      await (pinning as unknown as { processQueue(): Promise<void> }).processQueue();
      const failedJob = await PinningQueue.getJob(job.id);
      expect(failedJob!.status).toBe('failed');
      expect(failedJob!.retries).toBe(1);

      // Retry the failed job; pin operation recovers, job reaches pinned.
      ipfsNode.healEndpoint('pin_add');
      const retried = await PinningQueue.retryFailed(cid);
      expect(retried).not.toBeNull();
      expect(retried!.status).toBe('queued');

      await (pinning as unknown as { processQueue(): Promise<void> }).processQueue();
      const pinnedJob = await PinningQueue.getJob(job.id);
      expect(pinnedJob!.status).toBe('pinned');
      expect(await pinning.isPinned(cid)).toBe(true);
    });

    it('increments retries as a pin failure accumulates', async () => {
      const cid = (await client.add('increment-retries')).cid;
      const job = await pinning.pinContent(cid, 'grp-ir', 'crt-ir');

      ipfsNode.failEndpoint('pin_add');
      await (pinning as unknown as { processQueue(): Promise<void> }).processQueue();

      const failedJob = await PinningQueue.getJob(job.id);
      expect(failedJob!.status).toBe('failed');
      expect(failedJob!.retries).toBe(1);
      expect(failedJob!.maxRetries).toBe(3);
    });

    it('does not duplicate a pin when content is already pinned in redis', async () => {
      const cid = (await client.add('already-pinned')).cid;

      // Simulate that the CID is already tracked as pinned in redis, so
      // pinContent short-circuits and does not enqueue another job.
      mockRedis.set(`ipfs:pinned:cid:${cid}`, 'true');
      const queuedBefore = await mockRedis.zcard('ipfs:pinning:queue');
      await pinning.pinContent(cid, 'grp-dedup', 'crt-dedup');
      const queuedAfter = await mockRedis.zcard('ipfs:pinning:queue');
      expect(queuedAfter).toBe(queuedBefore);
    });
  });
});
