import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { IcEye, IcEyeOff } from '../icons/Icons';

export function PasswordField({
  autoComplete,
  id,
  label,
  maxLength,
  minLength = undefined,
  onChange,
  onKeyDown = undefined,
  placeholder,
  value,
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={inputId}>{label}</label>
      <div className="password-field">
        <input
          id={inputId}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
        />
        <button
          aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="password-visibility-toggle"
          onClick={() => setIsVisible((current) => !current)}
          type="button"
        >
          {isVisible ? <IcEyeOff /> : <IcEye />}
        </button>
      </div>
    </div>
  );
}

PasswordField.propTypes = {
  autoComplete: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string.isRequired,
  maxLength: PropTypes.number,
  minLength: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
};
