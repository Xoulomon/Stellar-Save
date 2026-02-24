import type { ComponentType } from 'react';


/**
 * Route metadata and configuration
 */
export interface RouteConfig {
  /** Unique route path */
  path: string;
  /** Component to render for this route */
  component: ComponentType;
  /** Whether this route requires authentication */
  protected: boolean;
  /** Optional route title for document.title */
  title?: string;
  /** Optional route description for metadata */
  description?: string;
}

/**
 * Route parameter types for type-safe parameter access
 */
export interface RouteParams extends Record<string, string | undefined> {
  groupId?: string;
}

