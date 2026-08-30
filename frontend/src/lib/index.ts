// lib/index.ts - Barrel exports for lib directory

// ── Typed, validated environment config (single source of truth) ─────────────
export { env, envSchema, parseEnv, EnvValidationError } from './env';
export type { Env, StellarNetwork } from './env';

// ── Shared SDK types & contract bindings (single source of truth) ─────────────
export type {
  Group,
  GroupFilters,
  GroupMember,
  GroupStatus,
  Contribution,
  ContributionStatus,
  Payout,
  PayoutStatus,
  Transaction,
  TransactionType,
  CostReport,
  ServiceCost,
  OptimizationRecommendation,
  PaginationMeta,
  PaginatedResponse,
} from '@stellar-save/sdk';
export {
  ContractError,
  parseContractError,
  CONTRACT_ERROR_MESSAGES,
  CONTRACT_FUNCTIONS,
  StellarSaveApiClient,
} from '@stellar-save/sdk';

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

// ── Low-level helpers (kept for backward compatibility) ───────────────────────
export { server, CONTRACT_ID } from './contractClient';

// ── Stellar Horizon service (wraps @stellar/stellar-sdk Horizon calls) ────────
export { stellarService, StellarService } from './stellarService';
export type {
  AccountBalance,
  AccountInfo,
  HorizonPaymentRecord,
  FetchPaymentsOptions,
  NetworkName,
} from './stellarService';

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

// ── Shared validation utilities ───────────────────────────────────────────────
export * as validation from './validation';

// ── Group filtering predicates ────────────────────────────────────────────────
export * from './filters';

// ── Clipboard & share-link helpers ───────────────────────────────────────────
export { copyToClipboard, shareOrCopy, isClipboardSupported, isShareSupported } from './clipboard';
export type { ShareData, ShareResult } from './clipboard';
