import PropTypes from 'prop-types';

function LogoutButton({ onLogout }) {
  return (
    <button
      type="button"
      className="logout-btn"
      onClick={onLogout}
      aria-label="Cerrar sesión y volver al inicio de sesión"
      title="Cerrar sesión"
    >
      Cerrar sesión
    </button>
  );
}

LogoutButton.propTypes = {
  onLogout: PropTypes.func.isRequired,
};

export default LogoutButton;
