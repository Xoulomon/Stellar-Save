export type TransactionType = 'payment' | 'swap' | 'deposit' | 'withdraw' | 'claimable' | 'other';

export interface Transaction {
  id: string;
  hash: string;
  createdAt: string;
  type: TransactionType;
  amount: string;
  assetCode: string;        // XLM, USDC, etc.
  assetIssuer?: string;
  from: string;
  to?: string;
  memo?: string;
  status: 'success' | 'pending' | 'failed';
  fee: string;
  operationCount?: number;
  // Add more fields from Horizon response as needed
}

export interface TransactionFilters {
  type?: TransactionType[];
  status?: ('success' | 'pending' | 'failed')[];
  dateFrom?: Date;
  dateTo?: Date;
  asset?: string;
}