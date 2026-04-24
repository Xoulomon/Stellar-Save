// lib/index.ts - Barrel exports for lib directory

export { server, CONTRACT_ID } from './contractClient';
export type { CreateGroupParams, ContributeParams } from './contractClient';
export { ContractError, parseContractError, CONTRACT_ERROR_MESSAGES } from './contractClient';

export type {
  GroupCreatedEvent,
  MemberJoinedEvent,
  ContributionMadeEvent,
  PayoutExecutedEvent,
  AppEvent,
  EventType,
  EventFilter,
} from '../types/events';
export { EventService, eventService } from './EventService';
