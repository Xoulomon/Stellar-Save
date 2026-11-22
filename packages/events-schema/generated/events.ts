// GENERATED FILE — do not edit manually.
// Source of truth: packages/events-schema/schema.json
// Schema version: 1
// To regenerate: node packages/events-schema/codegen.js

export interface GroupCreatedEvent {
  type: 'group_created';
  schemaVersion: number;
  groupId: bigint;
  creator: string;
  contributionAmount: bigint;
  cycleDuration: bigint;
  maxMembers: number;
  createdAt: bigint;
}

export interface MemberJoinedEvent {
  type: 'member_joined';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  memberCount: number;
  joinedAt: bigint;
}

export interface MemberLeftEvent {
  type: 'member_left';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  memberCount: number;
  leftAt: bigint;
}

export interface MemberRemovedEvent {
  type: 'member_removed';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  removedBy: string;
  memberCount: number;
  removedAt: bigint;
}

export interface ContributionMadeEvent {
  type: 'contribution_made';
  schemaVersion: number;
  groupId: bigint;
  contributor: string;
  amount: bigint;
  cycle: number;
  cycleTotal: bigint;
  contributedAt: bigint;
}

export interface ContributionDueEvent {
  type: 'contribution_due';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  cycle: number;
  deadline: bigint;
  emittedAt: bigint;
}

export interface PayoutExecutedEvent {
  type: 'payout_executed';
  schemaVersion: number;
  groupId: bigint;
  recipient: string;
  amount: bigint;
  cycle: number;
  executedAt: bigint;
}

export interface ContributionMissedEvent {
  type: 'contribution_missed';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  cycle: number;
  penaltyApplied: bigint;
  missedAt: bigint;
}

export interface GroupCompletedEvent {
  type: 'group_completed';
  schemaVersion: number;
  groupId: bigint;
  creator: string;
  totalCycles: number;
  totalDistributed: bigint;
  completedAt: bigint;
}

export interface GroupStatusChangedEvent {
  type: 'group_status_changed';
  schemaVersion: number;
  groupId: bigint;
  oldStatus: number;
  newStatus: number;
  changedBy: string;
  changedAt: bigint;
}

export interface GracePeriodContributionEvent {
  type: 'grace_period_contribution';
  schemaVersion: number;
  groupId: bigint;
  contributor: string;
  amount: bigint;
  cycle: number;
  secondsLate: bigint;
  contributedAt: bigint;
}

export interface GroupMetadataUpdatedEvent {
  type: 'group_metadata_updated';
  schemaVersion: number;
  groupId: bigint;
  updatedBy: string;
  name: string;
  description: string;
  imageUrl: string;
  updatedAt: bigint;
}

export interface ContractPausedEvent {
  type: 'contract_paused';
  schemaVersion: number;
  admin: string;
  timestamp: bigint;
}

export interface ContractUnpausedEvent {
  type: 'contract_unpaused';
  schemaVersion: number;
  admin: string;
  timestamp: bigint;
}

export interface CycleAdvancedEvent {
  type: 'cycle_advanced';
  schemaVersion: number;
  groupId: bigint;
  oldCycle: number;
  newCycle: number;
  payoutExecuted: boolean;
  defaulted: boolean;
  advancedAt: bigint;
}

export interface GroupPausedEvent {
  type: 'group_paused';
  schemaVersion: number;
  groupId: bigint;
  pausedBy: string;
  pausedAt: bigint;
}

export interface GroupUnpausedEvent {
  type: 'group_unpaused';
  schemaVersion: number;
  groupId: bigint;
  unpausedBy: string;
  unpausedAt: bigint;
}

export interface ContributionVerifiedEvent {
  type: 'contribution_verified';
  schemaVersion: number;
  groupId: bigint;
  contributor: string;
  cycle: number;
  verifiedAt: bigint;
}

export interface ContributionAmountProposedEvent {
  type: 'contribution_amount_proposed';
  schemaVersion: number;
  groupId: bigint;
  proposedBy: string;
  oldAmount: bigint;
  newAmount: bigint;
  proposedAt: bigint;
}

export interface ContributionAmountChangedEvent {
  type: 'contribution_amount_changed';
  schemaVersion: number;
  groupId: bigint;
  oldAmount: bigint;
  newAmount: bigint;
  effectiveCycle: number;
  changedAt: bigint;
}

export interface PenaltyAppliedEvent {
  type: 'penalty_applied';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  amount: bigint;
  cycleId: number;
  appliedAt: bigint;
}

export interface PenaltyRecoveredEvent {
  type: 'penalty_recovered';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  cycleId: number;
  recoveredAt: bigint;
}

export interface MilestoneReachedEvent {
  type: 'milestone_reached';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  threshold: number;
  reachedAtCycle: number;
}

export interface MemberInvitedEvent {
  type: 'member_invited';
  schemaVersion: number;
  groupId: bigint;
  invited: string;
  invitedBy: string;
  invitedAt: bigint;
}

export interface InvitationRevokedEvent {
  type: 'invitation_revoked';
  schemaVersion: number;
  groupId: bigint;
  revoked: string;
  revokedBy: string;
  revokedAt: bigint;
}

export interface GroupsMergedEvent {
  type: 'groups_merged';
  schemaVersion: number;
  mergedGroupId: bigint;
  sourceGroupId_1: bigint;
  sourceGroupId_2: bigint;
  memberCount: number;
  combinedBalance: bigint;
  mergedAt: bigint;
}

export interface RewardClaimedEvent {
  type: 'reward_claimed';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  amount: bigint;
  claimedAt: bigint;
}

export interface GroupArchivedEvent {
  type: 'group_archived';
  schemaVersion: number;
  groupId: bigint;
  archivedBy: string;
  archivedAt: bigint;
}

export interface AutoContributionExecutedEvent {
  type: 'auto_contribution_executed';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  amount: bigint;
  cycle: number;
  executedAt: bigint;
}

export interface AutoContributionFailedEvent {
  type: 'auto_contribution_failed';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  cycle: number;
  failedAt: bigint;
}

export interface GroupRatedEvent {
  type: 'group_rated';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  stars: number;
  comment: string;
  ratedAt: bigint;
}

export interface FeePaidEvent {
  type: 'fee_paid';
  schemaVersion: number;
  creator: string;
  treasury: string;
  amount: bigint;
  paidAt: bigint;
}

export interface RefundIssuedEvent {
  type: 'refund_issued';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  amount: bigint;
  cycle: number;
  refundedAt: bigint;
}

export interface MemberReferredEvent {
  type: 'member_referred';
  schemaVersion: number;
  groupId: bigint;
  invitee: string;
  referrer: string;
  referredAt: bigint;
}

export interface GroupDissolvedEvent {
  type: 'group_dissolved';
  schemaVersion: number;
  groupId: bigint;
  dissolvedAt: bigint;
  totalRefunded: bigint;
}

export interface GroupClonedEvent {
  type: 'group_cloned';
  schemaVersion: number;
  originalGroupId: bigint;
  newGroupId: bigint;
  creator: string;
  clonedAt: bigint;
}

export interface CycleDeadlineExtendedEvent {
  type: 'cycle_deadline_extended';
  schemaVersion: number;
  groupId: bigint;
  cycle: number;
  extensionSeconds: bigint;
  newDeadline: bigint;
  extendedBy: string;
  extendedAt: bigint;
}

export interface ContractUpgradedEvent {
  type: 'contract_upgraded';
  schemaVersion: number;
  upgradedBy: string;
  oldVersion: number;
  newVersion: number;
  upgradedAt: bigint;
}

export interface ContributionReceiptEvent {
  type: 'contribution_receipt';
  schemaVersion: number;
  groupId: bigint;
  member: string;
  amount: bigint;
  cycle: number;
  timestamp: bigint;
}

export interface DisputeRaisedEvent {
  type: 'dispute_raised';
  schemaVersion: number;
  groupId: bigint;
  raisedBy: string;
  reason: string;
  voteCount: number;
  threshold: number;
  autoPaused: boolean;
  raisedAt: bigint;
}

export interface DisputeResolvedEvent {
  type: 'dispute_resolved';
  schemaVersion: number;
  groupId: bigint;
  resolvedBy: string;
  resolution: string;
  resolvedAt: bigint;
}

export type ContractEvent =
  | GroupCreatedEvent
  | MemberJoinedEvent
  | MemberLeftEvent
  | MemberRemovedEvent
  | ContributionMadeEvent
  | ContributionDueEvent
  | PayoutExecutedEvent
  | ContributionMissedEvent
  | GroupCompletedEvent
  | GroupStatusChangedEvent
  | GracePeriodContributionEvent
  | GroupMetadataUpdatedEvent
  | ContractPausedEvent
  | ContractUnpausedEvent
  | CycleAdvancedEvent
  | GroupPausedEvent
  | GroupUnpausedEvent
  | ContributionVerifiedEvent
  | ContributionAmountProposedEvent
  | ContributionAmountChangedEvent
  | PenaltyAppliedEvent
  | PenaltyRecoveredEvent
  | MilestoneReachedEvent
  | MemberInvitedEvent
  | InvitationRevokedEvent
  | GroupsMergedEvent
  | RewardClaimedEvent
  | GroupArchivedEvent
  | AutoContributionExecutedEvent
  | AutoContributionFailedEvent
  | GroupRatedEvent
  | FeePaidEvent
  | RefundIssuedEvent
  | MemberReferredEvent
  | GroupDissolvedEvent
  | GroupClonedEvent
  | CycleDeadlineExtendedEvent
  | ContractUpgradedEvent
  | ContributionReceiptEvent
  | DisputeRaisedEvent
  | DisputeResolvedEvent;

export type ContractEventTopic = ContractEvent['type'];

export const CONTRACT_EVENT_TOPICS: ContractEventTopic[] = [
  'group_created',
  'member_joined',
  'member_left',
  'member_removed',
  'contribution_made',
  'contribution_due',
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
  'group_dissolved',
  'group_cloned',
  'cycle_deadline_extended',
  'contract_upgraded',
  'contribution_receipt',
  'dispute_raised',
  'dispute_resolved',
];

/** The schema version embedded in every on-chain event payload. */
export const CURRENT_SCHEMA_VERSION = 1;
