/**
 * notifications/types.ts
 *
 * Shared notification types used across both transport (push/webhook)
 * and presentation (UI toast) layers.
 *
 * This unified type system allows decoupled modules to communicate
 * through well-defined contracts without tight coupling.
 */

/**
 * Base notification severity type shared across UI and transport.
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Delivery channel for a notification. Transport uses this to decide
 * how to send; UI ignores this aspect.
 */
export type DeliveryChannel = 'browser' | 'email' | 'webhook';

/**
 * Core notification message that both transport and UI understand.
 * Transport sends this data; UI renders it.
 */
export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: number; // Unix ms
  channels?: DeliveryChannel[];
  metadata?: Record<string, unknown>; // Channel-specific data (groupId, etc)
}

/**
 * UI-specific rendering options (only used by presentation layer).
 * Transport does not need to know about these.
 */
export interface UIRenderOptions {
  duration?: number; // Auto-dismiss ms; undefined = no auto-dismiss
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

/**
 * Transport-specific delivery options (only used by delivery layer).
 * UI does not need to know about these.
 */
export interface TransportDeliveryOptions {
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
  endpoint?: string; // For webhook delivery
}

/**
 * Combined notification for UI rendering that merges message with UI options.
 * This is what the presentation layer consumes.
 */
export interface UINotification extends NotificationMessage {
  uiOptions?: UIRenderOptions;
}

/**
 * Combined notification for transport delivery.
 * Merges message with transport-specific options.
 */
export interface TransportNotification extends NotificationMessage {
  transportOptions?: TransportDeliveryOptions;
}

/**
 * Result of a transport delivery attempt.
 */
export interface DeliveryResult {
  success: boolean;
  channel: DeliveryChannel;
  error?: string;
  timestamp: number;
}

/**
 * Callback for transport completion (success or failure).
 */
export type DeliveryCallback = (result: DeliveryResult) => void;
