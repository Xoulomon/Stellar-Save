import { initiateDeposit, initiateWithdraw, syncTransactionStatus, sep10Auth } from '../services/sep24';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

jest.mock('../prisma_client', () => ({
  prisma: {
    rampTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require('../prisma_client');

const TOML_RESPONSE = `AUTH_SERVER = "https://anchor.example.com/auth"\nTRANSFER_SERVER_SEP0024 = "https://anchor.example.com/sep24"\n`;

// sep24 service calls fetchToml for sep10Auth separately, then again for TRANSFER_SERVER
function mockToml() {
  mockFetch.mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(TOML_RESPONSE) } as any);
}
function mockChallenge() {
  mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ transaction: 'mock-challenge-xdr' }) } as any);
}
function mockSep24Response(data: object) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(data) } as any);
}

describe('sep10Auth', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('returns challenge XDR as token', async () => {
    mockToml();
    mockChallenge();
    const token = await sep10Auth('anchor.example.com', 'GABC');
    expect(token).toBe('mock-challenge-xdr');
  });

  it('throws when auth server returns non-ok', async () => {
    mockToml();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as any);
    await expect(sep10Auth('anchor.example.com', 'GABC')).rejects.toThrow('500');
  });
});

describe('initiateDeposit', () => {
  const opts = { anchorDomain: 'anchor.example.com', stellarAccount: 'GABC', assetCode: 'USDC', userId: 'user1' };
  const createdRecord = { id: 'local-1', ...opts, type: 'deposit', status: 'pending_user_transfer_start', anchorId: 'anchor-tx-1', interactiveUrl: 'https://anchor.example.com/interactive', moreInfoUrl: null, startedAt: new Date(), updatedAt: new Date(), assetIssuer: null, amount: null };

  beforeEach(() => {
    mockFetch.mockReset();
    prisma.rampTransaction.create.mockResolvedValue(createdRecord);
  });

  it('creates a RampTransaction and returns interactive URL', async () => {
    // initiate() calls: fetchToml (for TRANSFER_SERVER), sep10Auth -> fetchToml + challenge, then deposit POST
    mockToml(); // fetchToml in initiate for TRANSFER_SERVER
    mockToml(); // fetchToml in sep10Auth
    mockChallenge(); // challenge fetch in sep10Auth
    mockSep24Response({ id: 'anchor-tx-1', url: 'https://anchor.example.com/interactive' });
    const result = await initiateDeposit(opts);
    expect(result.type).toBe('deposit');
    expect(result.interactiveUrl).toBe('https://anchor.example.com/interactive');
    expect(prisma.rampTransaction.create).toHaveBeenCalledTimes(1);
  });
});

describe('initiateWithdraw', () => {
  const opts = { anchorDomain: 'anchor.example.com', stellarAccount: 'GABC', assetCode: 'USDC', userId: 'user1' };
  const createdRecord = { id: 'local-2', ...opts, type: 'withdraw', status: 'pending_user_transfer_start', anchorId: 'anchor-tx-2', interactiveUrl: 'https://anchor.example.com/interactive', moreInfoUrl: null, startedAt: new Date(), updatedAt: new Date(), assetIssuer: null, amount: null };

  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
    prisma.rampTransaction.create.mockResolvedValue(createdRecord);
  });

  it('creates a RampTransaction of type withdraw', async () => {
    mockToml(); // fetchToml in initiate
    mockToml(); // fetchToml in sep10Auth
    mockChallenge();
    mockSep24Response({ id: 'anchor-tx-2', url: 'https://anchor.example.com/interactive' });
    const result = await initiateWithdraw(opts);
    expect(result.type).toBe('withdraw');
    expect(prisma.rampTransaction.create).toHaveBeenCalledTimes(1);
  });
});

describe('syncTransactionStatus', () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it('updates status from anchor and returns updated record', async () => {
    const existing = { id: 'local-1', anchorId: 'anchor-tx-1', anchorDomain: 'anchor.example.com', stellarAccount: 'GABC', status: 'pending_user_transfer_start' };
    const updated = { ...existing, status: 'completed', moreInfoUrl: null };
    prisma.rampTransaction.findUnique.mockResolvedValue(existing);
    prisma.rampTransaction.update.mockResolvedValue(updated);
    mockToml(); // fetchToml in syncTransactionStatus for TRANSFER_SERVER
    mockToml(); // fetchToml in sep10Auth
    mockChallenge();
    mockFetch.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ transaction: { status: 'completed' } }) } as any);
    const result = await syncTransactionStatus('local-1');
    expect(result.status).toBe('completed');
  });

  it('throws when record not found', async () => {
    prisma.rampTransaction.findUnique.mockResolvedValue(null);
    await expect(syncTransactionStatus('bad-id')).rejects.toThrow('not found');
  });
});
