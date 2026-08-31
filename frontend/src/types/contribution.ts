// Re-export shared primitives from the canonical SDK package so there is a
// single source of truth for these types across frontend, backend, and mobile.
export type { MemberStatus, PayoutStatus } from '@stellar-save/sdk';

import type { MemberStatus, PayoutStatus } from '@stellar-save/sdk';

// ─── Contribution-cycle types (frontend-specific) ─────────────────────────────

export interface Member {
  address: string
  name?: string
  contributed: boolean
  contributedAt?: Date
  amount?: number
}

export interface ContributionCycle {
  cycleId: number
  deadline: Date
  totalMembers: number
  contributedCount: number
  members: Member[]
  targetAmount: number
}

export type TransactionStatus =
  | 'idle'
  | 'confirming'
  | 'pending'
  | 'submitting'
  | 'success'
  | 'error'

export interface ContributeButtonProps {
  amount: number
  cycleId: number
  walletAddress?: string
  onSuccess?: (txHash: string) => void
  onError?: (error: Error) => void
  disabled?: boolean
}

export interface MemberCardData {
  address: string
  name?: string
  avatar?: string
  joinDate: Date
  contributionCount: number
  totalContributed: number
  payoutPosition: number
  totalMembers: number
  hasReceivedPayout: boolean
  status: MemberStatus
}

export interface PayoutEntry {
  position: number
  memberAddress: string
  memberName?: string
  estimatedDate: Date
  amount: number
  status: PayoutStatus
  txHash?: string
  paidAt?: Date
}

export interface PayoutQueueData {
  cycleId: number
  totalMembers: number
  entries: PayoutEntry[]
  currentUserAddress?: string
}
