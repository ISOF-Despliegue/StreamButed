import { memo } from 'react';
import { Link, NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  IcHome, IcSearch, IcLib, IcSettings,
  IcDashboard, IcUpload, IcChart, IcMusic, IcCamera,
  IcOverview, IcReport, IcShield, IcChevron,
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
      {item.icon}<span className="nav-item-label">{item.label}</span>
    </NavLink>
  );
}

function SidebarRestoreButton({ onToggle }) {
  return (
    <button
      className="sidebar-restore-button"
      type="button"
      aria-label="Mostrar barra lateral"
      onClick={onToggle}
      title="Mostrar barra lateral"
    >
      <IcChevron dir="right" />
    </button>
  );
}

function SidebarCollapsedRail({ onToggle }) {
  return (
    <div className="sidebar-collapsed-rail">
      <SidebarRestoreButton onToggle={onToggle} />
    </div>
  );
}

function SidebarCollapseButton({ onToggle }) {
  return (
    <button
      className="sidebar-toggle-button"
      type="button"
      aria-label="Ocultar barra lateral"
      onClick={onToggle}
      title="Ocultar barra lateral"
    >
      <IcChevron dir="left" />
      <span>Ocultar</span>
    </button>
  );
}

function SidebarSectionLabel({ children }) {
  return (
    <div
      style={{
        padding: '10px 16px 4px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: 'var(--t3)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

SidebarSectionLabel.propTypes = {
  children: PropTypes.node.isRequired,
};

function MainSidebarComponent({
  collapsed = false,
  onToggle,
  showCollapseButton = true,
  showNavigation = true,
  showDiscoverSection = true,
  showManageSection = true,
  user,
}) {
  if (collapsed) {
    return <SidebarCollapsedRail onToggle={onToggle} />;
  }

  const discoverItems = [
    { to: routes.home, end: true, label: 'Inicio', icon: <IcHome /> },
    { to: routes.search, label: 'Buscar', icon: <IcSearch /> },
    { to: routes.library, label: 'Biblioteca', icon: <IcLib /> },
    { to: routes.lives, label: 'En vivo', icon: <IcCamera /> },
    { to: routes.settings, label: 'Ajustes', icon: <IcSettings /> },
  ];

  const manageItems =
    user.role === 'artist'
      ? [
          { to: routes.artistDashboard, end: true, label: 'Panel', icon: <IcDashboard /> },
          { to: routes.artistTracks, label: 'Mis pistas', icon: <span className="nav-note-icon" aria-hidden="true">♪</span> },
          { to: routes.artistAlbums, label: 'Albumes', icon: <IcMusic /> },
          { to: routes.artistAnalytics, label: 'Analiticas', icon: <IcChart /> },
          { to: routes.artistUpload, label: 'Subir +', icon: <IcUpload /> },
          { to: routes.artistLive, label: 'Transmitir', icon: <IcCamera /> },
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
      {showCollapseButton ? <SidebarCollapseButton onToggle={onToggle} /> : null}

      {showNavigation ? (
        <>
          {showDiscoverSection ? (
            <>
              <SidebarSectionLabel>Descubrir</SidebarSectionLabel>
              <div className="sidebar-section" style={{ paddingTop: 4 }}>
                {discoverItems.map((item) => (
                  <SidebarNavItem key={item.to} item={item} />
                ))}
              </div>
            </>
          ) : null}

          {showManageSection && manageItems.length > 0 ? (
            <>
              <SidebarSectionLabel>Gestionar</SidebarSectionLabel>
              <div className="sidebar-section" style={{ paddingTop: 4 }}>
                {manageItems.map((item) => (
                  <SidebarNavItem key={item.to} item={item} />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <div className="sidebar-mobile-note">
          Las secciones principales ya estan disponibles en la barra inferior.
        </div>
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

function AdminSidebarComponent({
  collapsed = false,
  onToggle,
  showCollapseButton = true,
  showNavigation = true,
  user,
}) {
  if (collapsed) {
    return <SidebarCollapsedRail onToggle={onToggle} />;
  }

  const items = [
    { to: routes.adminOverview, end: true, label: 'Resumen', icon: <IcOverview /> },
    { to: routes.adminReports, label: 'Analiticas', icon: <IcReport /> },
    { to: routes.adminModeration, label: 'Moderacion', icon: <IcShield /> },
    { to: routes.settings, label: 'Ajustes', icon: <IcSettings /> },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">S</div>
        <div className="logo-text">StreamButed</div>
      </div>
      {showCollapseButton ? <SidebarCollapseButton onToggle={onToggle} /> : null}

      {showNavigation ? (
        <>
          <SidebarSectionLabel>Administracion</SidebarSectionLabel>
          <div className="sidebar-section" style={{ paddingTop: 4 }}>
            {items.map((item) => (
              <SidebarNavItem key={item.to} item={item} />
            ))}
          </div>
        </>
      ) : (
        <div className="sidebar-mobile-note">
          Las secciones administrativas ya estan disponibles en la barra inferior.
        </div>
      )}

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
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  showCollapseButton: PropTypes.bool,
  showDiscoverSection: PropTypes.bool,
  showManageSection: PropTypes.bool,
  showNavigation: PropTypes.bool,
  user: sidebarUserPropType.isRequired,
};

AdminSidebarComponent.propTypes = {
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  showCollapseButton: PropTypes.bool,
  showNavigation: PropTypes.bool,
  user: sidebarUserPropType.isRequired,
};

SidebarRestoreButton.propTypes = {
  onToggle: PropTypes.func.isRequired,
};

SidebarCollapsedRail.propTypes = {
  onToggle: PropTypes.func.isRequired,
};

SidebarCollapseButton.propTypes = {
  onToggle: PropTypes.func.isRequired,
};

export const MainSidebar = memo(MainSidebarComponent);
export const AdminSidebar = memo(AdminSidebarComponent);
