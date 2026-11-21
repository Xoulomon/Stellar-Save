import type { Transaction, TransactionType } from '../types/transaction';

export const HORIZON_URLS: Record<string, string> = {
  TESTNET: 'https://horizon-testnet.stellar.org',
  MAINNET: 'https://horizon.stellar.org',
  FUTURENET: 'https://horizon-futurenet.stellar.org',
};

export interface HorizonPayment {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  amount?: string;
  asset_code?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  memo?: string;
}

export async function fetchHorizonTransactions(
  address: string,
  network: string,
  contractId?: string
): Promise<Transaction[]> {
  const base = HORIZON_URLS[network] ?? HORIZON_URLS.TESTNET;
  const url = `${base}/accounts/${address}/payments?limit=50&order=desc`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizon error: ${res.status}`);

  const data = (await res.json()) as { _embedded: { records: HorizonPayment[] } };
  const records = data._embedded?.records ?? [];

  return records
    .filter((r) => !contractId || r.transaction_hash.includes(contractId.slice(0, 8)))
    .map((r): Transaction => ({
      id: r.id,
      hash: r.transaction_hash,
      createdAt: r.created_at,
      type: (r.type === 'payment' ? 'payment' : 'deposit') as TransactionType,
      amount: r.amount ? `+${r.amount}` : '0',
      assetCode: r.asset_code ?? (r.asset_type === 'native' ? 'XLM' : 'UNKNOWN'),
      from: r.from ?? address,
      to: r.to,
      memo: r.memo,
      status: 'success',
      fee: '0.00001',
    }));
}

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    hash: 'abc123def456abc123def456abc123de',
    createdAt: '2026-04-20T10:30:00Z',
    type: 'deposit',
    amount: '+250',
    assetCode: 'XLM',
    from: 'GABC...',
    to: 'GDEF...',
    memo: 'Group contribution cycle 2',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '2',
    hash: 'def456ghi789def456ghi789def456gh',
    createdAt: '2026-04-15T14:22:00Z',
    type: 'payment',
    amount: '+1000',
    assetCode: 'XLM',
    from: 'GDEF...',
    to: 'GABC...',
    memo: 'Payout cycle 1',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '3',
    hash: 'ghi789jkl012ghi789jkl012ghi789jk',
    createdAt: '2026-03-20T09:15:00Z',
    type: 'deposit',
    amount: '+250',
    assetCode: 'XLM',
    from: 'GABC...',
    to: 'GDEF...',
    memo: 'Group contribution cycle 1',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '4',
    hash: 'jkl012mno345jkl012mno345jkl012mn',
    createdAt: '2026-03-10T16:45:00Z',
    type: 'withdraw',
    amount: '-45.50',
    assetCode: 'USDC',
    from: 'GABC...',
    to: 'GXYZ...',
    memo: '',
    status: 'success',
    fee: '0.00001',
  },
  {
    id: '5',
    hash: 'mno345pqr678mno345pqr678mno345pq',
    createdAt: '2026-02-28T11:20:00Z',
    type: 'claimable',
    amount: '+15.75',
    assetCode: 'USDC',
    from: 'GXYZ...',
    memo: 'Reward claim',
    status: 'pending',
    fee: '0.00001',
  },
];
