export type RampTransactionType = 'deposit' | 'withdraw';

export type RampStatus =
  | 'pending_user_transfer_start'
  | 'pending_anchor'
  | 'pending_stellar'
  | 'pending_external'
  | 'completed'
  | 'refunded'
  | 'expired'
  | 'error';

export interface RampTransaction {
  id: string;
  userId: string;
  type: RampTransactionType;
  anchorDomain: string;
  stellarAccount: string;
  assetCode: string;
  assetIssuer: string | null;
  amount: string | null;
  anchorId: string | null;
  status: RampStatus;
  interactiveUrl: string | null;
  moreInfoUrl: string | null;
  startedAt: string;
  updatedAt: string;
}

export interface RampInitResponse {
  id: string;
  anchorId: string;
  interactiveUrl: string;
  type: RampTransactionType;
}

export interface KycStatusResult {
  userId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  kycId?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface RampFormData {
  anchorDomain: string;
  assetCode: string;
  assetIssuer?: string;
  amount?: string;
  stellarAccount?: string;
}
