import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { apiRequest } from '../apiClient';

describe('apiClient', () => {
  let fetchMock: MockInstance<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
    localStorage.clear();
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('sends typed JSON bodies and bearer authentication', async () => {
    localStorage.setItem('auth_token', 'test-token');
    fetchMock.mockResolvedValueOnce(Response.json({ data: { ok: true } }));

    await expect(
      apiRequest<{ ok: boolean }>('/test', {
        method: 'POST',
        authenticated: true,
        body: { value: 42 },
      })
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({ value: 42 }),
      })
    );
  });

  it('requires authentication before making a request', async () => {
    await expect(apiRequest('/private', { authenticated: true })).rejects.toThrow(
      'Authentication required'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for accepted statuses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(apiRequest<null>('/missing', { acceptedStatuses: [404] })).resolves.toBeNull();
  });

  it('throws the first API envelope error', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({
        data: null,
        errors: [{ code: 'BAD_REQUEST', message: 'Invalid request' }],
      })
    );

    await expect(apiRequest('/test')).rejects.toThrow('Invalid request');
  });
});
