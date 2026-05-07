import { useId } from 'react';

export function FilePicker({
  accept,
  file,
  onChange,
  helperText,
  buttonLabel = 'Seleccionar archivo',
}) {
  const inputId = useId();

  return (
    <div>
      <div className="file-picker-row">
        <input
          id={inputId}
          className="file-picker-input"
          type="file"
          accept={accept}
          onChange={onChange}
        />
        <label className="btn-primary file-picker-button" htmlFor={inputId}>
          {buttonLabel}
        </label>
      </div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
        {file ? file.name : helperText}
      </div>
    </div>
  );
}
