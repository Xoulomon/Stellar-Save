// GENERATED FILE — do not edit manually.
// Source of truth: packages/events-schema/schema.json
// Schema version: 1
// To regenerate: node packages/events-schema/codegen.js

export interface GroupCreatedEvent {
  type: 'group_created';
  groupId: bigint;
  creator: string;
  contributionAmount: bigint;
  cycleDuration: bigint;
  maxMembers: number;
  createdAt: bigint;
}

export interface MemberJoinedEvent {
  type: 'member_joined';
  groupId: bigint;
  member: string;
  memberCount: number;
  joinedAt: bigint;
}

export interface MemberLeftEvent {
  type: 'member_left';
  groupId: bigint;
  member: string;
  memberCount: number;
  leftAt: bigint;
}

export interface MemberRemovedEvent {
  type: 'member_removed';
  groupId: bigint;
  member: string;
  removedBy: string;
  memberCount: number;
  removedAt: bigint;
}

export interface ContributionMadeEvent {
  type: 'contribution_made';
  groupId: bigint;
  contributor: string;
  amount: bigint;
  cycle: number;
  cycleTotal: bigint;
  contributedAt: bigint;
}

export interface PayoutExecutedEvent {
  type: 'payout_executed';
  groupId: bigint;
  recipient: string;
  amount: bigint;
  cycle: number;
  executedAt: bigint;
}

export interface ContributionMissedEvent {
  type: 'contribution_missed';
  groupId: bigint;
  member: string;
  cycle: number;
  penaltyApplied: bigint;
  missedAt: bigint;
}

export interface GroupCompletedEvent {
  type: 'group_completed';
  groupId: bigint;
  creator: string;
  totalCycles: number;
  totalDistributed: bigint;
  completedAt: bigint;
}

export interface GroupStatusChangedEvent {
  type: 'group_status_changed';
  groupId: bigint;
  oldStatus: number;
  newStatus: number;
  changedBy: string;
  changedAt: bigint;
}

export interface GracePeriodContributionEvent {
  type: 'grace_period_contribution';
  groupId: bigint;
  contributor: string;
  amount: bigint;
  cycle: number;
  secondsLate: bigint;
  contributedAt: bigint;
}

export interface GroupMetadataUpdatedEvent {
  type: 'group_metadata_updated';
  groupId: bigint;
  updatedBy: string;
  name: string;
  description: string;
  imageUrl: string;
  updatedAt: bigint;
}

export interface ContractPausedEvent {
  type: 'contract_paused';
  admin: string;
  timestamp: bigint;
}

export interface ContractUnpausedEvent {
  type: 'contract_unpaused';
  admin: string;
  timestamp: bigint;
}

export interface CycleAdvancedEvent {
  type: 'cycle_advanced';
  groupId: bigint;
  oldCycle: number;
  newCycle: number;
  payoutExecuted: boolean;
  defaulted: boolean;
  advancedAt: bigint;
}

export interface GroupPausedEvent {
  type: 'group_paused';
  groupId: bigint;
  pausedBy: string;
  pausedAt: bigint;
}

export interface GroupUnpausedEvent {
  type: 'group_unpaused';
  groupId: bigint;
  unpausedBy: string;
  unpausedAt: bigint;
}

export interface ContributionVerifiedEvent {
  type: 'contribution_verified';
  groupId: bigint;
  contributor: string;
  cycle: number;
  verifiedAt: bigint;
}

export interface ContributionAmountProposedEvent {
  type: 'contribution_amount_proposed';
  groupId: bigint;
  proposedBy: string;
  oldAmount: bigint;
  newAmount: bigint;
  proposedAt: bigint;
}

export interface ContributionAmountChangedEvent {
  type: 'contribution_amount_changed';
  groupId: bigint;
  oldAmount: bigint;
  newAmount: bigint;
  effectiveCycle: number;
  changedAt: bigint;
}

export interface PenaltyAppliedEvent {
  type: 'penalty_applied';
  groupId: bigint;
  member: string;
  amount: bigint;
  cycleId: number;
  appliedAt: bigint;
}

export interface PenaltyRecoveredEvent {
  type: 'penalty_recovered';
  groupId: bigint;
  member: string;
  cycleId: number;
  recoveredAt: bigint;
}

export interface MilestoneReachedEvent {
  type: 'milestone_reached';
  groupId: bigint;
  member: string;
  threshold: number;
  reachedAtCycle: number;
}

export interface MemberInvitedEvent {
  type: 'member_invited';
  groupId: bigint;
  invited: string;
  invitedBy: string;
  invitedAt: bigint;
}

export interface InvitationRevokedEvent {
  type: 'invitation_revoked';
  groupId: bigint;
  revoked: string;
  revokedBy: string;
  revokedAt: bigint;
}

export interface GroupsMergedEvent {
  type: 'groups_merged';
  mergedGroupId: bigint;
  sourceGroupId_1: bigint;
  sourceGroupId_2: bigint;
  memberCount: number;
  combinedBalance: bigint;
  mergedAt: bigint;
}

export interface RewardClaimedEvent {
  type: 'reward_claimed';
  groupId: bigint;
  member: string;
  amount: bigint;
  claimedAt: bigint;
}

export interface GroupArchivedEvent {
  type: 'group_archived';
  groupId: bigint;
  archivedBy: string;
  archivedAt: bigint;
}

export interface AutoContributionExecutedEvent {
  type: 'auto_contribution_executed';
  groupId: bigint;
  member: string;
  amount: bigint;
  cycle: number;
  executedAt: bigint;
}

export interface AutoContributionFailedEvent {
  type: 'auto_contribution_failed';
  groupId: bigint;
  member: string;
  cycle: number;
  failedAt: bigint;
}

export interface GroupRatedEvent {
  type: 'group_rated';
  groupId: bigint;
  member: string;
  stars: number;
  comment: string;
  ratedAt: bigint;
}

export interface FeePaidEvent {
  type: 'fee_paid';
  creator: string;
  treasury: string;
  amount: bigint;
  paidAt: bigint;
}

export interface RefundIssuedEvent {
  type: 'refund_issued';
  groupId: bigint;
  member: string;
  amount: bigint;
  cycle: number;
  refundedAt: bigint;
}

export interface MemberReferredEvent {
  type: 'member_referred';
  groupId: bigint;
  invitee: string;
  referrer: string;
  referredAt: bigint;
}

export type ContractEvent =
  | GroupCreatedEvent |
  | MemberJoinedEvent |
  | MemberLeftEvent |
  | MemberRemovedEvent |
  | ContributionMadeEvent |
  | PayoutExecutedEvent |
  | ContributionMissedEvent |
  | GroupCompletedEvent |
  | GroupStatusChangedEvent |
  | GracePeriodContributionEvent |
  | GroupMetadataUpdatedEvent |
  | ContractPausedEvent |
  | ContractUnpausedEvent |
  | CycleAdvancedEvent |
  | GroupPausedEvent |
  | GroupUnpausedEvent |
  | ContributionVerifiedEvent |
  | ContributionAmountProposedEvent |
  | ContributionAmountChangedEvent |
  | PenaltyAppliedEvent |
  | PenaltyRecoveredEvent |
  | MilestoneReachedEvent |
  | MemberInvitedEvent |
  | InvitationRevokedEvent |
  | GroupsMergedEvent |
  | RewardClaimedEvent |
  | GroupArchivedEvent |
  | AutoContributionExecutedEvent |
  | AutoContributionFailedEvent |
  | GroupRatedEvent |
  | FeePaidEvent |
  | RefundIssuedEvent |
  | MemberReferredEvent;

export type ContractEventTopic = ContractEvent['type'];

export const CONTRACT_EVENT_TOPICS: ContractEventTopic[] = [
  'group_created',
  'member_joined',
  'member_left',
  'member_removed',
  'contribution_made',
  'payout_executed',
  'contribution_missed',
  'group_completed',
  'group_status_changed',
  'grace_period_contribution',
  'group_metadata_updated',
  'contract_paused',
  'contract_unpaused',
  'cycle_advanced',
  'group_paused',
  'group_unpaused',
  'contribution_verified',
  'contribution_amount_proposed',
  'contribution_amount_changed',
  'penalty_applied',
  'penalty_recovered',
  'milestone_reached',
  'member_invited',
  'invitation_revoked',
  'groups_merged',
  'reward_claimed',
  'group_archived',
  'auto_contribution_executed',
  'auto_contribution_failed',
  'group_rated',
  'fee_paid',
  'refund_issued',
  'member_referred',
];
