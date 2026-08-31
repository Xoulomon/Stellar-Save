// Re-exports from the canonical event schema.
// DO NOT add event type definitions here — edit packages/events-schema/schema.json
// and run: node packages/events-schema/codegen.js
export type {
  ContractEvent,
  ContractEventTopic,
  GroupCreatedEvent,
  MemberJoinedEvent,
  MemberLeftEvent,
  MemberRemovedEvent,
  ContributionMadeEvent,
  PayoutExecutedEvent,
  ContributionMissedEvent,
  GroupCompletedEvent,
  GroupStatusChangedEvent,
  GracePeriodContributionEvent,
  GroupMetadataUpdatedEvent,
  ContractPausedEvent,
  ContractUnpausedEvent,
  CycleAdvancedEvent,
  GroupPausedEvent,
  GroupUnpausedEvent,
  ContributionVerifiedEvent,
  ContributionAmountProposedEvent,
  ContributionAmountChangedEvent,
  PenaltyAppliedEvent,
  PenaltyRecoveredEvent,
  MilestoneReachedEvent,
  MemberInvitedEvent,
  InvitationRevokedEvent,
  GroupsMergedEvent,
  RewardClaimedEvent,
  GroupArchivedEvent,
  AutoContributionExecutedEvent,
  AutoContributionFailedEvent,
  GroupRatedEvent,
  FeePaidEvent,
  RefundIssuedEvent,
  MemberReferredEvent,
} from '../../../packages/events-schema/generated/events';
export { CONTRACT_EVENT_TOPICS } from '../../../packages/events-schema/generated/events';

// Legacy alias kept for backward compatibility
export type AppEvent = ContractEvent;
export type EventType = ContractEventTopic;

import type { ContractEvent, ContractEventTopic } from '../../../packages/events-schema/generated/events';

export interface EventFilter {
  types?: ContractEventTopic[];
  groupIds?: bigint[];
}
