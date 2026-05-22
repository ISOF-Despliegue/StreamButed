import { memo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  IcHome, IcSearch, IcLib, IcSettings,
  IcDashboard, IcUpload, IcChart, IcMusic,
  IcOverview, IcReport, IcShield,
} from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';
import { routes } from '../../routes/appRoutes';

function SidebarNavItem({ item }) {
  return (
    <NavLink
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      end={item.end}
      to={item.to}
    >
      {item.icon}<span>{item.label}</span>
    </NavLink>
  );
}

/**
 * MainSidebar - used by both listeners and artists.
 *
 * Discover section is always visible.
 * Manage section is gated behind the artist role so that capability expansion
 * feels seamless rather than abrupt (no sidebar swap on promotion).
 */
function MainSidebarComponent({ user }) {
  const discoverItems = [
    { to: routes.home, end: true, label: 'Inicio', icon: <IcHome /> },
    { to: routes.search, label: 'Buscar', icon: <IcSearch /> },
    { to: routes.library, label: 'Biblioteca', icon: <IcLib /> },
    { to: routes.lives, label: 'En vivo', icon: <span style={{ fontSize: 14 }}>Vivo</span> },
    { to: routes.settings, label: 'Ajustes', icon: <IcSettings /> },
  ];

  // Manage items are only shown when the user holds the artist role.
  const manageItems =
    user.role === 'artist'
      ? [
          { to: routes.artistDashboard, end: true, label: 'Panel', icon: <IcDashboard /> },
          { to: routes.artistTracks, label: 'Mis pistas', icon: <span className="nav-note-icon" aria-hidden="true">♩</span> },
          { to: routes.artistAlbums, label: 'Álbumes', icon: <IcMusic /> },
          { to: routes.artistAnalytics, label: 'Analíticas', icon: <IcChart /> },
          { to: routes.artistUpload, label: 'Subir +', icon: <IcUpload /> },
          { to: routes.artistLive, label: 'Transmitir', icon: <span style={{ fontSize: 14 }}>Vivo</span> },
        ]
      : []; 

  const roleLabel = user.role === 'artist' ? 'Artista' : 'Oyente';
  const profilePath = user.role === 'artist' && user.id
    ? routes.artistProfile(user.id)
    : routes.settings;
  const profileLabel = user.role === 'artist'
    ? `Ver perfil de ${user.username}`
    : 'Abrir ajustes';

  const avatarNode = user.profileImageAssetId ? (
    <img
      src={getAssetUrl(user.profileImageAssetId)}
      alt={`Foto de perfil de ${user.username || 'usuario'}`}
    />
  ) : (
    user.username[0]?.toUpperCase()
  );

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">S</div>
        <div className="logo-text">StreamButed</div>
      </div>

      {/* Discover section - always visible */}
      <div
        style={{
          padding: '10px 20px 4px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--t3)',
          textTransform: 'uppercase',
        }}
      >
        Descubrir
      </div>
      <div className="sidebar-section" style={{ paddingTop: 4 }}>
        {discoverItems.map((item) => (
          <SidebarNavItem key={item.to} item={item} />
        ))}
      </div>

      {/* Manage section - visible only for artists */}
      {manageItems.length > 0 && (
        <>
          <div
            style={{
              padding: '10px 20px 4px',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--t3)',
              textTransform: 'uppercase',
            }}
          >
            Gestionar
          </div>
          <div className="sidebar-section" style={{ paddingTop: 4 }}>
            {manageItems.map((item) => (
              <SidebarNavItem key={item.to} item={item} />
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <Link className="user-chip" to={profilePath} aria-label={profileLabel}>
          <div className="user-avatar">{avatarNode}</div>
          <div className="user-info">
            <div className="user-name">{user.username}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function AdminSidebarComponent({ user }) {
  const items = [
    { to: routes.adminOverview, end: true, label: 'Resumen', icon: <IcOverview /> },
    { to: routes.adminReports, label: 'Analíticas', icon: <IcReport /> },
    { to: routes.adminModeration, label: 'Moderación', icon: <IcShield /> },
    { to: routes.settings, label: 'Ajustes', icon: <IcSettings /> },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">S</div>
        <div className="logo-text">StreamButed</div>
      </div>
      <div
        style={{
          padding: '10px 20px 4px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--t3)',
          textTransform: 'uppercase',
        }}
      >
        Administración
      </div>
      <div className="sidebar-section" style={{ paddingTop: 4 }}>
        {items.map((it) => (
          <SidebarNavItem
            key={it.to}
            item={it}
          />
        ))}
      </div>
      <div className="sidebar-footer">
        <Link className="user-chip" to={routes.settings} aria-label="Abrir ajustes">
          <div
            className="user-avatar"
            style={{ background: 'rgba(167,139,250,0.2)', color: '#A78BFA' }}
          >
            {user.profileImageAssetId ? (
              <img
                src={getAssetUrl(user.profileImageAssetId)}
                alt={`Foto de perfil de ${user.username || 'usuario'}`}
              />
            ) : (
              user.username[0]?.toUpperCase()
            )}
          </div>
          <div className="user-info">
            <div className="user-name">{user.username}</div>
            <div className="user-role">Administrador</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

const sidebarItemPropType = PropTypes.shape({
  end: PropTypes.bool,
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
});

const sidebarUserPropType = PropTypes.shape({
  id: PropTypes.string,
  profileImageAssetId: PropTypes.string,
  role: PropTypes.string,
  username: PropTypes.string,
});

SidebarNavItem.propTypes = {
  item: sidebarItemPropType.isRequired,
};

MainSidebarComponent.propTypes = {
  user: sidebarUserPropType.isRequired,
};

AdminSidebarComponent.propTypes = {
  user: sidebarUserPropType.isRequired,
};

export const MainSidebar = memo(MainSidebarComponent);
export const AdminSidebar = memo(AdminSidebarComponent);
