/**
 * Audit Event Log - Type Definitions
 *
 * This module defines types and interfaces for audit event logging.
 * Future implementations can use these types to implement audit trail functionality.
 *
 * Note: The actual audit event writing functionality was removed in Issue #1696
 * as it was not actively used. Historical event types are documented below
 * for reference if audit logging is re-implemented.
 */

/**
 * Type of actor performing an audit action.
 *
 * @example 'user' | 'admin' | 'system' | 'service'
 */
export type AuditActorType = 'user' | 'admin' | 'system' | 'service';

/**
 * Audit event action type.
 *
 * This type is extensible via the `string` union member, allowing custom action types.
 *
 * **Reserved (unused, removed in Issue #1696):**
 * - 'ambassador.created' - Ambassador profile created
 * - 'ambassador.updated' - Ambassador profile updated
 * - 'ambassador.deleted' - Ambassador profile deleted
 * - 'ambassador.status_changed' - Ambassador tier changed
 * - 'aml.flagged' - Transaction flagged by AML screening
 * - 'aml.reviewed' - AML flag reviewed by admin
 * - 'aml.cleared' - AML flag cleared
 * - 'admin.action' - Generic admin action
 *
 * @example
 * type MyAction = AuditAction;
 * const action: MyAction = 'custom.event' + Math.random(); // Any string allowed
 */
export type AuditAction = string;

/**
 * Input shape for creating an audit event.
 *
 * Use this interface when implementing audit event logging functionality.
 *
 * @example
 * const event: AuditEventInput = {
 *   actor: 'user@example.com',
 *   actorType: 'user',
 *   action: 'my.custom.action',
 *   target: 'target-id-123',
 *   targetType: 'entity_type',
 *   metadata: { field: 'value' },
 *   timestamp: new Date(),
 * };
 */
export interface AuditEventInput {
  /** Who performed the action. */
  actor: string;
  /** Type of actor performing the action. */
  actorType?: AuditActorType;
  /** What happened. */
  action: AuditAction;
  /** The entity the action was performed against. */
  target: string;
  /** Optional target entity type (e.g. 'ambassador', 'aml_case'). */
  targetType?: string;
  /** Optional structured metadata for the event. */
  metadata?: Record<string, unknown>;
  /** Optional explicit timestamp; defaults to now. */
  timestamp?: Date;
}

/**
 * Recorded audit event shape.
 *
 * Use this interface when implementing audit event retrieval functionality.
 *
 * @example
 * const record: AuditEventRecord = {
 *   id: 'audit_1695744000000_abc123',
 *   actor: 'user@example.com',
 *   actorType: 'user',
 *   action: 'my.custom.action',
 *   target: 'target-id-123',
 *   targetType: 'entity_type',
 *   metadata: { field: 'value' },
 *   timestamp: new Date('2026-09-26T10:00:00Z'),
 * };
 */
export interface AuditEventRecord {
  id: string;
  actor: string;
  actorType: AuditActorType;
  action: AuditAction;
  target: string;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
}
