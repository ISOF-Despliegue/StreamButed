import PropTypes from 'prop-types';

export function InlineState({ title, message, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-text">{title}</div>
      {message && <div className="empty-sub">{message}</div>}
      {onRetry && <button className="btn-ghost" onClick={onRetry} style={{ marginTop: 14 }}>Reintentar</button>}
    </div>
  );
}

InlineState.propTypes = {
  message: PropTypes.string,
  onRetry: PropTypes.func,
  title: PropTypes.string.isRequired,
};
