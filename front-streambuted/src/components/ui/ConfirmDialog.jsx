import { useEffect, useId, useRef } from 'react';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
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
    if (!open) return undefined;

    previousActiveElementRef.current = document.activeElement;
    dialogRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus?.();
    };
  }, [isLoading, onCancel, open]);

  if (!open) return null;

  const confirmClassName = tone === 'danger' ? 'btn-danger confirm-dialog-danger' : 'btn-primary';

  return (
    <div
      className="confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className={`confirm-dialog-marker ${tone}`} aria-hidden="true" />
        <div className="confirm-dialog-title" id={titleId}>{title}</div>
        {message && <p className="confirm-dialog-message" id={messageId}>{message}</p>}
        {children && <div className="confirm-dialog-body">{children}</div>}
        <div className="confirm-dialog-actions">
          <button className="btn-ghost" type="button" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            className={confirmClassName}
            type="button"
            onClick={onConfirm}
            disabled={disabled || isLoading}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
