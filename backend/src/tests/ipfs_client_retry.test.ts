/**
 * Retry behaviour of the IPFS client, now backed by the shared `withRetry`
 * utility from `@stellar-save/shared-utils` (issue #1699).
 *
 * The pre-existing `src/ipfs/client.test.ts` sits outside this directory, so
 * jest's `testMatch` (`src/tests/**`) never runs it, and it depends on
 * `global.fetch` already being a jest mock. These cases live where the backend
 * suite actually collects them and set up the mock explicitly.
 */

import { IpfsClient } from '../ipfs/client';

import type { RetryConfig } from '../ipfs/client';

const okResponse = (cid: string, size = '1024') => ({
  ok: true,
  status: 200,
  json: async () => ({ Hash: cid, Size: size, Pins: [cid], ID: cid }),
  text: async () => '',
});

describe('IpfsClient retry behaviour', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('succeeds on the first attempt without retrying', async () => {
    mockFetch.mockResolvedValue(okResponse('QmFirst'));

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 3 });

    await expect(client.add('data')).resolves.toEqual({ cid: 'QmFirst', size: 1024 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries a transient network failure and then succeeds', async () => {
    const failure = new Error('Network error');
    mockFetch
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(okResponse('QmRetried'));

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 3 });

    await expect(client.add('data')).resolves.toEqual({ cid: 'QmRetried', size: 1024 });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // `maxRetries` has always excluded the initial attempt, so the shared
  // utility's total-attempt count must not change the number of calls made.
  it('treats maxRetries as retries after the first attempt', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });

    await expect(client.add('data')).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('makes a single call when maxRetries is 0', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 0 });

    await expect(client.add('data')).rejects.toThrow('Network error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rethrows the final failure rather than an empty error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 1 });

    await expect(client.add('data')).rejects.toThrow('Network error');
  });

  it('waits progressively longer between retries', async () => {
    const failure = new Error('Network error');
    mockFetch
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(okResponse('QmBackoff'));

    const client = new IpfsClient('http://localhost:5001', 1000, {
      maxRetries: 3,
      initialDelayMs: 30,
      backoffMultiplier: 2,
    });

    const started = Date.now();
    await client.add('data');
    const elapsed = Date.now() - started;

    // Delays of ~30ms then ~60ms.
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('caps the delay between retries at maxDelayMs', async () => {
    const failure = new Error('Network error');
    mockFetch.mockRejectedValue(failure);

    const client = new IpfsClient('http://localhost:5001', 1000, {
      maxRetries: 4,
      initialDelayMs: 50,
      backoffMultiplier: 10,
      maxDelayMs: 60,
    } satisfies RetryConfig);

    const started = Date.now();
    await expect(client.add('data')).rejects.toThrow('Network error');
    const elapsed = Date.now() - started;

    // Without the cap the delays would grow to 50 + 500 + 5000 + 50000ms.
    expect(elapsed).toBeLessThan(1000);
  });

  it('retries the other client methods, not just add', async () => {
    const failure = new Error('Network error');
    mockFetch
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ ...okResponse('QmPin'), json: async () => ({ Pins: ['QmPin'] }) });

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });

    await expect(client.pinAdd('QmPin')).resolves.toEqual({ cid: 'QmPin', pinned: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // The shared utility rethrows the original rejection value, but this client
  // has always surfaced an Error. Callers read `.message`, so a raw string must
  // not escape.
  it('surfaces a non-Error rejection as an Error', async () => {
    mockFetch.mockRejectedValue('plain string failure');

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 0 });

    await expect(client.add('data')).rejects.toThrow(Error);
    await expect(client.add('data')).rejects.toThrow('plain string failure');
  });

  it('surfaces a non-2xx API response as an error after retries', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 1 });

    await expect(client.add('data')).rejects.toThrow('IPFS API error 500');
  });
});
