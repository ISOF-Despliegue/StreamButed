import PropTypes from 'prop-types';

function Placeholder({ title, message }) {
  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-title">{title}</div>
      </div>
      <div className="empty-state">
        <div className="empty-text">Integracion pendiente</div>
        <div className="empty-sub">{message}</div>
      </div>
    </div>
  );
}

Placeholder.propTypes = {
  message: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export function AdminOverviewPage() {
  return (
    <div className="page-inner">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="page-title">Overview</div>
      </div>

      <div className="stat-cards">
        <div className="stat-card"><div className="stat-card-label">Identity Service</div><div className="stat-card-value">Conectado</div></div>
        <div className="stat-card"><div className="stat-card-label">Catalog Service</div><div className="stat-card-value">Conectado</div></div>
        <div className="stat-card"><div className="stat-card-label">Media Service</div><div className="stat-card-value">Conectado</div></div>
        <div className="stat-card"><div className="stat-card-label">Analytics</div><div className="stat-card-value">Pendiente</div></div>
      </div>

      <div className="settings-card" style={{ maxWidth: 860 }}>
        <div className="settings-card-title">Panel administrativo preparado</div>
        <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
          No hay endpoints administrativos para usuarios, reportes, moderacion global o analitica.
          Por eso se removieron tablas, graficas y actividad mock de la UI productiva.
        </p>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  return (
    <Placeholder
      title="User Management"
      message="Identity expone /users/me y /users/promote para el usuario autenticado, pero no una API administrativa de usuarios en esta iteracion."
    />
  );
}

export function AdminModerationPage() {
  return (
    <Placeholder
      title="Content Moderation"
      message="Catalog permite crear, editar y retirar contenido propio de artista. No hay API de moderacion global ni reportes de contenido disponibles."
    />
  );
}
