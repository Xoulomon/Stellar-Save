// events.ts
// TypeScript definitions for StellarSave smart contract events

import type { Address } from '@stellar/stellar-sdk';

export interface GroupCreatedEvent {
  type: 'GroupCreated';
  groupId: bigint;
  creator: string;
  contributionAmount: bigint;
  cycleDuration: bigint;
  maxMembers: number;
  createdAt: bigint;
}

export interface ContributionMadeEvent {
  type: 'ContributionMade';
  groupId: bigint;
  contributor: string;
  amount: bigint;
  cycle: number;
  cycleTotal: bigint;
  contributedAt: bigint;
}

export interface PayoutExecutedEvent {
  type: 'PayoutExecuted';
  groupId: bigint;
  recipient: string;
  amount: bigint;
  cycle: number;
  executedAt: bigint;
}

export type AppEvent = GroupCreatedEvent | ContributionMadeEvent | PayoutExecutedEvent;

export type EventType = AppEvent['type'];

export interface EventFilter {
  types?: EventType[];
  groupIds?: bigint[];
}
