// lib/index.ts - Barrel exports for lib directory

// ── Typed SDK client (preferred import point for all contract calls) ──────────
export { StellarSaveClient, stellarSaveClient } from './client';
export type {
  CreateGroupParams,
  JoinGroupParams,
  ContributeParams,
  ActivateGroupParams,
  ExecutePayoutParams,
  PauseGroupParams,
  PayoutScheduleEntry,
} from './client';

// ── Low-level helpers (re-exported for backward compatibility) ────────────────
export { server, CONTRACT_ID } from './contractClient';
export { ContractError, parseContractError, CONTRACT_ERROR_MESSAGES } from './contractClient';

// ── Event service ─────────────────────────────────────────────────────────────
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
