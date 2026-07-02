import { submitKyc, getKycStatus, pollAndUpdateStatus, verifyKycWebhookSignature } from '../services/kyc';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

jest.mock('../prisma_client', () => ({
  prisma: {
    kycRecord: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    kycStatusEvent: {
      create: jest.fn(),
    },
  },
}));

const { prisma } = require('../prisma_client');

const baseRecord = {
  userId: 'user1',
  walletAddress: 'GABC',
  status: 'pending',
  kycProviderId: 'prov-1',
  submittedAt: new Date(),
  updatedAt: new Date(),
  reviewedAt: null,
};

beforeEach(() => {
  mockFetch.mockReset();
  jest.clearAllMocks();
  prisma.kycRecord.create?.mockReset?.();
  prisma.kycStatusEvent.create.mockResolvedValue({});
});

describe('submitKyc', () => {
  it('creates a pending KYC record', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'prov-1' }) } as any);
    prisma.kycRecord.upsert.mockResolvedValue(baseRecord);
    const result = await submitKyc({ userId: 'user1', walletAddress: 'GABC', fields: { first_name: 'Alice' } });
    expect(result.status).toBe('pending');
    expect(result.kycId).toBe('prov-1');
    expect(prisma.kycRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it('still creates record even when provider is unavailable', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 } as any);
    prisma.kycRecord.upsert.mockResolvedValue(baseRecord);
    const result = await submitKyc({ userId: 'user1', walletAddress: 'GABC', fields: {} });
    expect(result.status).toBe('pending');
  });
});

describe('getKycStatus', () => {
  it('returns default pending when no record exists', async () => {
    prisma.kycRecord.findUnique.mockResolvedValue(null);
    const result = await getKycStatus('nobody');
    expect(result.status).toBe('pending');
  });

  it('returns existing record status', async () => {
    prisma.kycRecord.findUnique.mockResolvedValue({ ...baseRecord, status: 'approved', reviewedAt: new Date() });
    const result = await getKycStatus('user1');
    expect(result.status).toBe('approved');
  });
});

describe('pollAndUpdateStatus', () => {
  it('transitions pending to approved and emits event', async () => {
    prisma.kycRecord.findUnique
      .mockResolvedValueOnce(baseRecord)         // first call in pollAndUpdateStatus
      .mockResolvedValueOnce({ ...baseRecord, status: 'approved', reviewedAt: new Date() }); // getKycStatus at end
    prisma.kycRecord.update.mockResolvedValue({ ...baseRecord, status: 'approved' });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'approved' }) } as any);
    const result = await pollAndUpdateStatus('user1');
    expect(result.status).toBe('approved');
    expect(prisma.kycStatusEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ oldStatus: 'pending', newStatus: 'approved' }) })
    );
  });

  it('does not emit event when status unchanged', async () => {
    prisma.kycRecord.findUnique.mockResolvedValue(baseRecord);
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'pending' }) } as any);
    prisma.kycRecord.findUnique.mockResolvedValue(baseRecord); // for final getKycStatus
    await pollAndUpdateStatus('user1');
    expect(prisma.kycStatusEvent.create).not.toHaveBeenCalled();
  });
});

describe('verifyKycWebhookSignature', () => {
  it('returns true for valid signature', () => {
    const secret = 'mysecret';
    const body = JSON.stringify({ userId: 'u1', status: 'approved' });
    const crypto = require('crypto');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyKycWebhookSignature(secret, body, sig)).toBe(true);
  });

  it('returns false for invalid signature', () => {
    expect(verifyKycWebhookSignature('secret', 'body', 'badsig')).toBe(false);
  });
});
