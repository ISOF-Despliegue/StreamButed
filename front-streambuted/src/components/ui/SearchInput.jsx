import PropTypes from 'prop-types';
import { IcSearch } from '../icons/Icons';
import { TEXT_LIMITS } from '../../constants/textLimits';

export function SearchInput({
  cooldownUntil = 0,
  id,
  maxLength = TEXT_LIMITS.searchTerm,
  onChange,
  onSubmit,
  placeholder,
  value,
  wrapperClassName = '',
}) {
  const isCoolingDown = cooldownUntil > Date.now();

  return (
    <div className={`search-input-wrap${wrapperClassName ? ` ${wrapperClassName}` : ''}`}>
      <button
        className="search-icon-button"
        type="button"
        aria-label="Buscar"
        disabled={isCoolingDown}
        onClick={() => onSubmit('manual')}
      >
        <IcSearch />
      </button>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            onSubmit('manual');
          }
        }}
        maxLength={maxLength}
      />
    </div>
  );
}

SearchInput.propTypes = {
  cooldownUntil: PropTypes.number,
  id: PropTypes.string,
  maxLength: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  wrapperClassName: PropTypes.string,
};
