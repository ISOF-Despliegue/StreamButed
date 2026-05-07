import {
  IcHome, IcSearch, IcLib, IcSettings,
  IcDashboard, IcTracks, IcUpload, IcChart, IcMusic,
  IcOverview, IcUsers, IcContent, IcReport, IcShield,
} from '../icons/Icons';
import { getAssetUrl } from '../../services/mediaService';

/**
 * MainSidebar — used by both listeners and artists.
 *
 * Discover section is always visible.
 * Manage section is gated behind the artist role so that capability expansion
 * feels seamless rather than abrupt (no sidebar swap on promotion).
 */
export function MainSidebar({ page, setPage, user }) {
  const discoverItems = [
    { id: 'home', label: 'Home', icon: <IcHome /> },
    { id: 'search', label: 'Search', icon: <IcSearch /> },
    { id: 'library', label: 'Library', icon: <IcLib /> },
    { id: 'lives', label: 'Lives', icon: <span style={{ fontSize: 14 }}>Live</span> },
    { id: 'settings', label: 'Settings', icon: <IcSettings /> },
  ];

  // Manage items are only shown when the user holds the artist role.
  const manageItems =
    user.role === 'artist'
      ? [
          { id: 'artist-dashboard', label: 'Dashboard', icon: <IcDashboard /> },
          { id: 'artist-tracks', label: 'My Tracks', icon: <IcTracks /> },
          { id: 'artist-albums', label: 'Albums', icon: <IcMusic /> },
          { id: 'artist-analytics', label: 'Analytics', icon: <IcChart /> },
          { id: 'artist-upload', label: 'Upload +', icon: <IcUpload /> },
          { id: 'lives', label: 'Do Live', icon: <span style={{ fontSize: 14 }}>Live</span> },
        ]
      : [];

  const NavItem = ({ item }) => (
    <div
      key={item.id}
      className={`nav-item${page === item.id ? ' active' : ''}`}
      onClick={() => setPage(item.id)}
    >
      {item.icon}<span>{item.label}</span>
    </div>
  );

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

      {/* Discover section — always visible */}
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
          <NavItem key={item.id} item={item} />
        ))}
      </div>

      {/* Manage section — visible only for artists */}
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
              <NavItem key={item.id} item={item} />
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

export function AdminSidebar({ page, setPage, user }) {
  const items = [
    { id: 'admin-overview', label: 'Overview', icon: <IcOverview /> },
    { id: 'admin-users', label: 'Usuarios', icon: <IcUsers /> },
    { id: 'admin-content', label: 'Contenido', icon: <IcContent /> },
    { id: 'admin-reports', label: 'Reportes', icon: <IcReport /> },
    { id: 'admin-moderation', label: 'Moderación', icon: <IcShield /> },
    { id: 'settings', label: 'Settings', icon: <IcSettings /> },
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
          <div
            key={it.id}
            className={`nav-item${page === it.id ? ' active' : ''}`}
            onClick={() => setPage(it.id)}
          >
            {it.icon}<span>{it.label}</span>
          </div>
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
