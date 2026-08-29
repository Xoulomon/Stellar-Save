// Re-export shared primitives from the canonical SDK package so there is a
// single source of truth for these types across frontend, backend, and mobile.
//
// NOTE: The GraphQL API uses a different Transaction shape — see the generated
// types in `src/generated/graphql.ts` (Transaction, TransactionType).
// The types below represent the Stellar Horizon REST API / on-chain shape.
export type { TransactionType, Transaction } from '@stellar-save/sdk';

import type { TransactionType } from '@stellar-save/sdk';

// TransactionFilters is frontend-only (date range, asset filter for the UI)
export interface TransactionFilters {
  type?: TransactionType[];
  status?: ('success' | 'pending' | 'failed')[];
  dateFrom?: Date;
  dateTo?: Date;
  asset?: string;
}
