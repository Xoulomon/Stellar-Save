/**
 * Mirrors the backend wire contract (see backend/src/models.ts). Kept in sync
 * by the contract test in backend/test/integration/fixtures-contract.test.ts,
 * which asserts these shapes against the real mock data and API responses.
 */

export interface ApiGroup {
  id: string;
  name: string;
  contributionAmount: number;
  cycleDuration: number;
  maxMembers: number;
  currentMembers: number;
  status: string;
  tags: string[];
  flagged?: boolean;
}

export interface ApiMember {
  id: string;
  address: string;
  name: string;
  joinedAt: number;
  groupIds: string[];
  flagged?: boolean;
}

export interface ApiTransaction {
  id: string;
  groupId: string;
  memberAddress: string;
  amount: number;
  type: 'contribution' | 'payout';
  timestamp: number;
  stellarTxHash: string;
}

/** Frontend view-model shapes (see frontend/src/types/{group,member}.ts). */

export interface PublicGroupLike {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  memberCount: number;
  contributionAmount: number;
  currency: string;
  status: 'active' | 'completed' | 'pending';
  createdAt: Date;
  cycleDuration?: number;
}

export interface GroupMemberLike {
  id: string;
  address: string;
  name?: string;
  joinedAt: Date;
  totalContributions: number;
  isActive: boolean;
}

export interface MemberProfileLike {
  address: string;
  name?: string;
  avatar?: string;
  joinDate: Date;
  contributionCount: number;
  totalContributed: number;
  payoutPosition: number;
  totalMembers: number;
  hasReceivedPayout: boolean;
  status: 'active' | 'inactive' | 'pending' | 'removed';
  streak?: number;
  lastContributedAt?: Date;
}

export interface SdkTransactionLike {
  id: string;
  hash: string;
  createdAt: string;
  type: 'payment' | 'swap' | 'deposit' | 'withdraw' | 'claimable' | 'other';
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  from: string;
  to?: string;
  memo?: string;
  status: 'success' | 'pending' | 'failed';
  fee: string;
}
