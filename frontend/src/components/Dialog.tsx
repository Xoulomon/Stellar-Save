import { useCallback, useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

import { useFocusTrap } from '../hooks/useFocusTrap';

import './Dialog.css';

export interface DialogProps {
  /** Whether the dialog is rendered. */
  open: boolean;
  /** Called when the user dismisses the dialog (Escape, backdrop, close button). */
  onClose: () => void;
  /** Dialog content. */
  children: ReactNode;
  /**
   * Visible title. Rendered as an `<h2>` and wired to `aria-labelledby`.
   * Omit it only when the content supplies its own labelling element via
   * `labelledBy`, or when passing `aria-label`.
   */
  title?: ReactNode;
  /** Supporting text under the title, wired to `aria-describedby`. */
  description?: ReactNode;
  /** Footer content — typically the action buttons. */
  footer?: ReactNode;
  /** id of an existing element that labels the dialog (wins over `title`). */
  labelledBy?: string;
  /** id of an existing element that describes the dialog (wins over `description`). */
  describedBy?: string;
  /** Accessible name used when there is no visible title element. */
  'aria-label'?: string;
  /** Dismiss when the backdrop is clicked. Default `true`. */
  closeOnBackdropClick?: boolean;
  /** Dismiss when Escape is pressed. Default `true`. */
  closeOnEscape?: boolean;
  /** Render the header "×" button. Default `true`. */
  showCloseButton?: boolean;
  /** Accessible label for the "×" button. Default `"Close dialog"`. */
  closeLabel?: string;
  /** Extra class applied to the dialog surface. */
  className?: string;
}

/**
 * Accessible modal dialog primitive.
 *
 * Provides the behaviour every modal in the app needs: a focus trap that
 * restores focus to the trigger on close (via {@link useFocusTrap}),
 * Escape-to-close, click-outside-to-close, `role="dialog"` + `aria-modal`, and a
 * background scroll lock. Consumers supply only the content and the labelling.
 */
export function Dialog({
  open,
  onClose,
  children,
  title,
  description,
  footer,
  labelledBy,
  describedBy,
  'aria-label': ariaLabel,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  closeLabel = 'Close dialog',
  className,
}: DialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();

  const titleId = labelledBy ?? (title != null ? `${generatedId}-title` : undefined);
  const descriptionId =
    describedBy ?? (description != null ? `${generatedId}-description` : undefined);

  useFocusTrap(surfaceRef, open);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (!open) return;

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleBackdropClick = closeOnBackdropClick
    ? (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onClose();
      }
    : undefined;

  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick}>
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-label={titleId ? undefined : ariaLabel}
        className={className ? `dialog ${className}` : 'dialog'}
      >
        {(title != null || showCloseButton) && (
          <div className="dialog__header">
            {title != null ? (
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {showCloseButton && (
              <button
                type="button"
                className="dialog__close"
                aria-label={closeLabel}
                onClick={onClose}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {description != null && (
          <p id={descriptionId} className="dialog__description">
            {description}
          </p>
        )}

        <div className="dialog__body">{children}</div>

        {footer != null && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Dialog;
