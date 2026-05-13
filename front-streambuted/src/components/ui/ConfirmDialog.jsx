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
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className={`confirm-dialog-marker ${tone}`} aria-hidden="true" />
        <div className="confirm-dialog-title" id="confirm-dialog-title">{title}</div>
        {message && <p className="confirm-dialog-message" id="confirm-dialog-message">{message}</p>}
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
