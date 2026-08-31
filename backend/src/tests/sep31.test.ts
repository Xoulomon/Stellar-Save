import { validateComplianceFields, getQuote, sendPayment, getPaymentStatus } from '../services/sep31';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

jest.mock('../prisma_client', () => ({
  prisma: {
    crossBorderPayment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require('../prisma_client');

const TOML = `DIRECT_PAYMENT_SERVER = "https://anchor.example.com/sep31"\n`;

function mockToml() {
  mockFetch.mockResolvedValueOnce({ ok: true, text: async () => TOML } as any);
}
function mockInfo(fields: Record<string, { optional?: boolean }> = { first_name: {}, last_name: {} }) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ receive: { USDC: { fields } } }) } as any);
}

beforeEach(() => {
  mockFetch.mockReset();
  jest.clearAllMocks();
});

describe('validateComplianceFields', () => {
  it('passes when all required fields are provided', async () => {
    mockToml();
    mockInfo({ first_name: {}, last_name: {} });
    await expect(validateComplianceFields('anchor.example.com', { first_name: 'Alice', last_name: 'Smith' })).resolves.toBeUndefined();
  });

  it('throws when required fields are missing', async () => {
    mockToml();
    mockInfo({ first_name: {}, last_name: {} });
    await expect(validateComplianceFields('anchor.example.com', { first_name: 'Alice' })).rejects.toThrow('last_name');
  });

  it('passes optional-only field schemas with empty fields', async () => {
    mockToml();
    mockInfo({ memo: { optional: true } });
    await expect(validateComplianceFields('anchor.example.com', {})).resolves.toBeUndefined();
  });
});

describe('getQuote', () => {
  it('returns rate, fee, expiresAt from anchor', async () => {
    mockToml();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rate: '1.02', fee: '0.50', expires_at: '2026-07-01T00:00:00Z' }) } as any);
    const quote = await getQuote({ anchorDomain: 'anchor.example.com', sendAsset: 'USDC', receiveAsset: 'NGN', amount: '100' });
    expect(quote.rate).toBe('1.02');
    expect(quote.fee).toBe('0.50');
  });
});

describe('sendPayment', () => {
  const opts = { anchorDomain: 'anchor.example.com', sendAssetCode: 'USDC', receiveAssetCode: 'NGN', amount: '100', senderId: 'GABC', receiverId: 'receiver-1', fields: { first_name: 'Alice', last_name: 'Smith' } };
  const anchorResponse = { id: 'anchor-tx-1', stellar_account_id: 'GXYZ', stellar_memo: '12345', stellar_memo_type: 'id' };
  const dbRecord = { id: 'local-1', ...opts, anchorTxId: 'anchor-tx-1', status: 'pending', stellarAccount: 'GXYZ' };

  it('validates fields, calls anchor, stores record', async () => {
    mockToml(); // for validateComplianceFields
    mockInfo({ first_name: {}, last_name: {} });
    mockToml(); // for getDirectPaymentServer in sendPayment
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => anchorResponse } as any);
    prisma.crossBorderPayment.create.mockResolvedValue(dbRecord);
    const result = await sendPayment(opts);
    expect(result.anchorTxId).toBe('anchor-tx-1');
    expect(prisma.crossBorderPayment.create).toHaveBeenCalledTimes(1);
  });

  it('throws when compliance fields are missing', async () => {
    mockToml();
    mockInfo({ first_name: {}, last_name: {}, id_number: {} });
    await expect(sendPayment({ ...opts, fields: { first_name: 'Alice' } })).rejects.toThrow('id_number');
  });
});

describe('getPaymentStatus', () => {
  it('reconciles to completed status', async () => {
    const existing = { id: 'local-1', anchorTxId: 'anchor-tx-1', status: 'pending' };
    prisma.crossBorderPayment.findUnique.mockResolvedValue(existing);
    prisma.crossBorderPayment.update.mockResolvedValue({ ...existing, status: 'completed' });
    mockToml();
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ transaction: { status: 'completed', completed_at: '2026-06-30T10:00:00Z' } }) } as any);
    const result = await getPaymentStatus('anchor.example.com', 'local-1');
    expect(result.status).toBe('completed');
    expect(result.completedAt).toBe('2026-06-30T10:00:00Z');
  });

  it('throws when record not found', async () => {
    prisma.crossBorderPayment.findUnique.mockResolvedValue(null);
    await expect(getPaymentStatus('anchor.example.com', 'bad-id')).rejects.toThrow('not found');
  });
});
