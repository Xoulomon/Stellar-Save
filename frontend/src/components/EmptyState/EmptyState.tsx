import React from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  illustration?: React.ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /**
   * Accessible label surfaced to screen readers via `aria-label`.
   * Defaults to the visible `title` when omitted.
   */
  'aria-label'?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  illustration,
  title = 'Nothing here',
  description,
  actionLabel,
  onAction,
  className = '',
  'aria-label': ariaLabel,
}) => {
  return (
    <div
      className={['empty-state', className].filter(Boolean).join(' ')}
      role="status"
      aria-label={ariaLabel ?? title ?? undefined}
    >
      {illustration ? <div className="empty-state__illustration">{illustration}</div> : null}

      <div className="empty-state__content">
        {title ? <h3 className="empty-state__title">{title}</h3> : null}
        {description ? <p className="empty-state__description">{description}</p> : null}

        {actionLabel ? (
          <button type="button" className="empty-state__action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default EmptyState;
