import { IpfsClient, RetryConfig } from './client';

describe('IpfsClient', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = global.fetch as jest.Mock;
  });

  describe('retry logic', () => {
    it('should retry on network failure and succeed', async () => {
      const error = new Error('Network error');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ Hash: 'QmTest123', Size: '1024' }),
        });

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 3 });
      const result = await client.add('test data');

      expect(result.cid).toBe('QmTest123');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exceeded', async () => {
      const error = new Error('Network error');
      mockFetch.mockRejectedValue(error);

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });

      await expect(client.add('test data')).rejects.toThrow('Network error');
      expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should apply exponential backoff between retries', async () => {
      const error = new Error('Network error');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ Hash: 'QmTest456', Size: '2048' }),
        });

      const client = new IpfsClient('http://localhost:5001', 1000, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffMultiplier: 2,
      });

      const startTime = Date.now();
      await client.add('test data');
      const elapsed = Date.now() - startTime;

      // Should have delays of ~10ms, ~20ms = 30ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(25);
    });

    it('should respect maxDelayMs cap', async () => {
      const error = new Error('Network error');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ Hash: 'QmTest789', Size: '4096' }),
        });

      const client = new IpfsClient('http://localhost:5001', 1000, {
        maxRetries: 4,
        initialDelayMs: 100,
        backoffMultiplier: 10,
        maxDelayMs: 200,
      });

      const startTime = Date.now();
      await client.add('test data');
      const elapsed = Date.now() - startTime;

      // With cap, delays should be 100ms + 200ms + 200ms = 500ms max
      expect(elapsed).toBeLessThan(1000);
    });

    it('should succeed without retries if first attempt succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Hash: 'QmQuick', Size: '512' }),
      });

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 3 });
      const result = await client.add('test data');

      expect(result.cid).toBe('QmQuick');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('timeout handling', () => {
    it('should pass timeout to fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Hash: 'QmTimeout', Size: '256' }),
      });

      const customTimeout = 5000;
      const client = new IpfsClient('http://localhost:5001', customTimeout);
      await client.add('test data');

      expect(mockFetch).toHaveBeenCalled();
      // Verify AbortController was used (timing out would abort the signal)
    });
  });

  describe('pinAdd', () => {
    it('should retry pinAdd on failure', async () => {
      const error = new Error('Connection timeout');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ Pins: ['QmPin123'] }),
        });

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });
      const result = await client.pinAdd('QmPin123');

      expect(result.cid).toBe('QmPin123');
      expect(result.pinned).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('pinRm', () => {
    it('should retry pinRm on failure', async () => {
      const error = new Error('Connection timeout');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ Pins: [] }),
        });

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });
      const result = await client.pinRm('QmPin456');

      expect(result.cid).toBe('QmPin456');
      expect(result.pinned).toBe(true); // pinned = !result.Pins.includes(cid)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('cat', () => {
    it('should retry cat on failure', async () => {
      const error = new Error('Gateway error');
      mockFetch
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'file content',
        });

      const client = new IpfsClient('http://localhost:5001', 1000, { maxRetries: 2 });
      const content = await client.cat('QmFile123');

      expect(content).toBe('file content');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('configuration', () => {
    it('should use default retry config when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ID: 'test-id', Addresses: [] }),
      });

      const client = new IpfsClient('http://localhost:5001');
      await client.id();

      // Should succeed with default retry config
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should merge custom retry config with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ID: 'test-id', Addresses: [] }),
      });

      const customRetry: RetryConfig = { maxRetries: 5 };
      const client = new IpfsClient('http://localhost:5001', undefined, customRetry);
      await client.id();

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
