/**
 * Standardized UI state components (issue #2032).
 *
 * This barrel provides the single import point for the three canonical
 * "async data" feedback components used throughout the application.
 *
 * Usage:
 *   import { LoadingState, EmptyState, ErrorState } from '@/components/ui';
 */

export { LoadingState } from '../LoadingState/LoadingState';
export type { LoadingStateProps } from '../LoadingState/LoadingState';

export { EmptyState } from '../EmptyState/EmptyState';
export type { EmptyStateProps } from '../EmptyState/EmptyState';

export { ErrorState } from '../ErrorState/ErrorState';
export type { ErrorStateProps } from '../ErrorState/ErrorState';
