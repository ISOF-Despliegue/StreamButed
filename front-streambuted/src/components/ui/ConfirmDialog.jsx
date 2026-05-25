import { useEffect, useId, useRef } from 'react';
import PropTypes from 'prop-types';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  showCancel = true,
  tone = 'danger',
  isLoading = false,
  disabled = false,
  children = null,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!open) {
      previousActiveElementRef.current?.focus?.();
      return undefined;
    }

    previousActiveElementRef.current = document.activeElement;
    const dialogNode = dialogRef.current;
    const initialFocusTarget = dialogNode?.querySelector(
      '[data-dialog-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
    );
    initialFocusTarget?.focus?.();
    if (!initialFocusTarget) {
      dialogNode?.focus();
    }

    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading, onCancel, open]);

  if (!open) return null;

  const confirmClassName = tone === 'danger' ? 'btn-danger confirm-dialog-danger' : 'btn-primary';

  return (
    <div
      className="confirm-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <dialog
        className="confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        open
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className={`confirm-dialog-marker ${tone}`} aria-hidden="true" />
        <div className="confirm-dialog-title" id={titleId}>{title}</div>
        {message && <p className="confirm-dialog-message" id={messageId}>{message}</p>}
        {children && <div className="confirm-dialog-body">{children}</div>}
        <div className="confirm-dialog-actions">
          {showCancel && (
            <button className="btn-ghost" type="button" onClick={onCancel} disabled={isLoading}>
              {cancelLabel}
            </button>
          )}
          <button
            className={confirmClassName}
            type="button"
            onClick={onConfirm}
            disabled={disabled || isLoading}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </dialog>
    </div>
  );
}

ConfirmDialog.propTypes = {
  cancelLabel: PropTypes.string,
  children: PropTypes.node,
  confirmLabel: PropTypes.string,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  message: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  open: PropTypes.bool.isRequired,
  showCancel: PropTypes.bool,
  title: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['danger', 'primary']),
};
