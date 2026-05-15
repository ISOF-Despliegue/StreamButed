import { useRef } from 'react';
import PropTypes from 'prop-types';

export function ProgressBar({ value, max, onChange, style }) {
  const ref = useRef(null);
  const safeMax = max > 0 ? max : 1;

  const handleClick = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const pct = (e.clientX - rect.left) / rect.width;
    onChange?.(Math.round(pct * safeMax));
  };

  return (
    <button
      aria-label="Cambiar progreso"
      className="progress-bar"
      onClick={handleClick}
      ref={ref}
      style={style}
      type="button"
    >
      <div className="progress-fill" style={{ width: `${Math.min(100, (value / safeMax) * 100)}%` }} />
    </button>
  );
}

ProgressBar.propTypes = {
  max: PropTypes.number.isRequired,
  onChange: PropTypes.func,
  style: PropTypes.object,
  value: PropTypes.number.isRequired,
};
