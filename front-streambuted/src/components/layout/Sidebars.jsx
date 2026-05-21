import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  IcHome, IcSearch, IcLib, IcSettings,
  IcDashboard, IcTracks, IcUpload, IcChart, IcMusic,
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
    { to: routes.home, end: true, label: 'Home', icon: <IcHome /> },
    { to: routes.search, label: 'Search', icon: <IcSearch /> },
    { to: routes.library, label: 'Library', icon: <IcLib /> },
    { to: routes.lives, label: 'Lives', icon: <span style={{ fontSize: 14 }}>Live</span> },
    { to: routes.settings, label: 'Settings', icon: <IcSettings /> },
  ];

  // Manage items are only shown when the user holds the artist role.
  const manageItems =
    user.role === 'artist'
      ? [
          { to: routes.artistDashboard, end: true, label: 'Dashboard', icon: <IcDashboard /> },
          { to: routes.artistTracks, label: 'My Tracks', icon: <IcTracks /> },
          { to: routes.artistAlbums, label: 'Albums', icon: <IcMusic /> },
          { to: routes.artistAnalytics, label: 'Analytics', icon: <IcChart /> },
          { to: routes.artistUpload, label: 'Upload +', icon: <IcUpload /> },
          { to: routes.artistLive, label: 'Do Live', icon: <span style={{ fontSize: 14 }}>Live</span> },
        ]
      : []; 

  const roleLabel = user.role === 'artist' ? 'Artist' : 'Listener';

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
        Discover
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
            Manage
          </div>
          <div className="sidebar-section" style={{ paddingTop: 4 }}>
            {manageItems.map((item) => (
              <SidebarNavItem key={item.to} item={item} />
            ))}
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{avatarNode}</div>
          <div className="user-info">
            <div className="user-name">{user.username}</div>
            <div className="user-role">{roleLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminSidebarComponent({ user }) {
  const items = [
    { to: routes.adminOverview, end: true, label: 'Overview', icon: <IcOverview /> },
    { to: routes.adminReports, label: 'Analytics', icon: <IcReport /> },
    { to: routes.adminModeration, label: 'Moderación', icon: <IcShield /> },
    { to: routes.settings, label: 'Settings', icon: <IcSettings /> },
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
        Admin Panel
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
        <div className="user-chip">
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
            <div className="user-role">Administrator</div>
          </div>
        </div>
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
