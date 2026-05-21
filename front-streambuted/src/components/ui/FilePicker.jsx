import { useEffect, useId, useRef } from 'react';
import PropTypes from 'prop-types';

export function FilePicker({
  accept,
  file,
  onChange,
  helperText,
  buttonLabel = 'Seleccionar archivo',
}) {
  const inputId = useId();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [file]);

  return (
    <div>
      <div className="file-picker-row">
        <input
          id={inputId}
          ref={inputRef}
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

FilePicker.propTypes = {
  accept: PropTypes.string.isRequired,
  buttonLabel: PropTypes.string,
  file: PropTypes.shape({
    name: PropTypes.string,
  }),
  helperText: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
