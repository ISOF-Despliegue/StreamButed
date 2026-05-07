import { useCallback, useState, type ReactNode } from "react";
import "./index.css";
import "./App.css";

import { Toast } from "./components/ui/Toast";
import { BottomPlayer } from "./components/layout/BottomPlayer";
import { ExpandedPlayer } from "./components/layout/ExpandedPlayer";
import { MainSidebar, AdminSidebar } from "./components/layout/Sidebars";
import LogoutButton from "./components/layout/LogoutButton";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { SettingsPage } from "./pages/SettingsPage";
import {
  HomePage,
  SearchPage,
  AlbumDetailPage,
  ArtistProfilePage,
} from "./pages/listener/ListenerPages";
import {
  ArtistDashboardPage,
  MyTracksPage,
  MyAlbumsPage,
  UploadSinglePage,
  CreateAlbumPage,
  EditTrackPage,
  ArtistAnalyticsPage,
} from "./pages/artist/ArtistPages";
import {
  AdminOverviewPage,
  AdminUsersPage,
  AdminModerationPage,
} from "./pages/admin/AdminPages";
import { RoleRoute } from "./routes/RoleRoute";
import { useAuth } from "./hooks/useAuth";
import type { CurrentUser } from "./types/user.types";
import type { Track } from "./types/catalog.types";

type AuthPage = "login" | "register";

type AppTrack = Track & {
  id?: string;
  artist?: string;
  duration?: number;
  plays?: number;
};

type SessionBarProps = {
  user: CurrentUser;
  roleLabel: string;
  onLogout: () => void;
};

function SessionBar({ user, roleLabel, onLogout }: SessionBarProps) {
  return (
    <header className="session-bar">
      <div className="session-meta" aria-live="polite">
        Sesion activa: <strong>{user.username}</strong> - {roleLabel}
      </div>
      <LogoutButton onLogout={onLogout} />
    </header>
  );
}

function NotAvailableState({ title, message }: { title: string; message: string }) {
  return (
    <div className="page-inner">
      <div className="page-title">{title}</div>
      <div className="empty-state">
        <div className="empty-text">Servicio no disponible todavia</div>
        <div className="empty-sub">{message}</div>
      </div>
    </div>
  );
}

export default function StreamButed() {
  const { user, isLoadingSession, login, register, logout } = useAuth();

  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [page, setPage] = useState<string>("home");
  const [viewAlbum, setViewAlbum] = useState<string | null>(null);
  const [viewArtist, setViewArtist] = useState<string | null>(null);
  const [editTrack, setEditTrack] = useState<AppTrack | null>(null);
  const [uploadAlbumId, setUploadAlbumId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AppTrack | null>(null);
  const [trackQueue, setTrackQueue] = useState<AppTrack[]>([]);
  const [volume, setVolume] = useState<number>(72);
  const [expandedPlayer, setExpandedPlayer] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  const resetNavigation = useCallback((nextUser: CurrentUser | null) => {
    setPage(nextUser?.role === "admin" ? "admin-overview" : "home");
    setViewAlbum(null);
    setViewArtist(null);
    setEditTrack(null);
    setUploadAlbumId(null);
    setCurrentTrack(null);
    setTrackQueue([]);
    setExpandedPlayer(false);
  }, []);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    const loggedUser = await login(credentials);
    resetNavigation(loggedUser);
  };

  const handleRegister = async (request: { email: string; username: string; password: string }) => {
    const registeredUser = await register(request);
    resetNavigation(registeredUser);
  };

  const handleLogout = async () => {
    await logout();
    setAuthPage("login");
    resetNavigation(null);
    setToastMsg(null);
  };

  const selectTrack = useCallback(
    (track: AppTrack) => {
      setCurrentTrack(track);
      setTrackQueue((queue) => {
        const trackId = track.trackId || track.id;
        if (queue.some((item) => (item.trackId || item.id) === trackId)) {
          return queue;
        }
        return [...queue, track];
      });
      toast("Player preparado. Streaming Service aun no esta disponible.");
    },
    [toast]
  );

  if (isLoadingSession) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-logo"><div className="auth-logo-mark">S</div></div>
          <div className="auth-title">Cargando sesion</div>
          <div className="auth-sub">Validando refresh token con Identity Service...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authPage === "login") {
      return (
        <LoginPage
          onLogin={handleLogin}
          onRegister={() => setAuthPage("register")}
        />
      );
    }

    return (
      <RegisterPage
        onRegister={handleRegister}
        onBack={() => setAuthPage("login")}
      />
    );
  }

  const roleLabel =
    user.role === "admin"
      ? "Administrador"
      : user.role === "artist"
      ? "Artista"
      : "Oyente";

  const expandedPlayerNode =
    expandedPlayer && currentTrack ? (
      <ExpandedPlayer
        track={currentTrack}
        queue={trackQueue.length ? trackQueue : [currentTrack]}
        onClose={() => setExpandedPlayer(false)}
        volume={volume}
        setVolume={setVolume}
        onSelectTrack={selectTrack}
      />
    ) : null;

  const allPages: Record<string, ReactNode> = {
    home: (
      <HomePage
        setPage={setPage}
      />
    ),
    search: (
      <SearchPage
        onPlayTrack={selectTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
        setViewArtist={setViewArtist}
      />
    ),
    library: (
      <NotAvailableState
        title="Biblioteca"
        message="La API de biblioteca personal todavia no existe. Esta vista queda lista para conectarse cuando el backend exponga favoritos o colecciones."
      />
    ),
    lives: (
      <NotAvailableState
        title="Lives"
        message="El modulo de transmisiones en vivo aun no esta disponible. No se solicitan camara ni microfono hasta que Live Service tenga una API operativa."
      />
    ),
    "album-detail": (
      <AlbumDetailPage
        albumId={viewAlbum}
        setPage={setPage}
        setViewArtist={setViewArtist}
      />
    ),
    "artist-profile": (
      <ArtistProfilePage
        artistId={viewArtist}
        onPlayTrack={selectTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
      />
    ),
    "artist-dashboard": (
      <RoleRoute allowedRoles={["artist"]}>
        <ArtistDashboardPage user={user} onPlayTrack={selectTrack} currentTrack={currentTrack} setPage={setPage} />
      </RoleRoute>
    ),
    "artist-tracks": (
      <RoleRoute allowedRoles={["artist"]}>
        <MyTracksPage setPage={setPage} setEditTrack={setEditTrack} toast={toast} user={user} />
      </RoleRoute>
    ),
    "artist-albums": (
      <RoleRoute allowedRoles={["artist"]}>
        <MyAlbumsPage setPage={setPage} setUploadAlbumId={setUploadAlbumId} toast={toast} user={user} />
      </RoleRoute>
    ),
    "artist-upload": (
      <RoleRoute allowedRoles={["artist"]}>
        <UploadSinglePage
          toast={toast}
          user={user}
          initialAlbumId={uploadAlbumId}
          onUploadAlbumConsumed={() => setUploadAlbumId(null)}
        />
      </RoleRoute>
    ),
    "artist-album": (
      <RoleRoute allowedRoles={["artist"]}>
        <CreateAlbumPage toast={toast} />
      </RoleRoute>
    ),
    "artist-edit-track": (
      <RoleRoute allowedRoles={["artist"]}>
        <EditTrackPage track={editTrack} user={user} setPage={setPage} toast={toast} />
      </RoleRoute>
    ),
    "artist-analytics": (
      <RoleRoute allowedRoles={["artist"]}>
        <ArtistAnalyticsPage />
      </RoleRoute>
    ),
    "admin-overview": (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminOverviewPage />
      </RoleRoute>
    ),
    "admin-users": (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminUsersPage />
      </RoleRoute>
    ),
    "admin-content": (
      <RoleRoute allowedRoles={["admin"]}>
        <NotAvailableState
          title="Contenido"
          message="No hay endpoints administrativos de catalogo para moderacion global en esta iteracion."
        />
      </RoleRoute>
    ),
    "admin-reports": (
      <RoleRoute allowedRoles={["admin"]}>
        <NotAvailableState
          title="Reportes"
          message="Analytics Service no tiene API HTTP ni ruta de gateway disponible."
        />
      </RoleRoute>
    ),
    "admin-moderation": (
      <RoleRoute allowedRoles={["admin"]}>
        <AdminModerationPage />
      </RoleRoute>
    ),
    settings: <SettingsPage user={user} toast={toast} />,
  };

  if (user.role === "admin") {
    return (
      <div className="app-shell">
        <SessionBar user={user} roleLabel={roleLabel} onLogout={handleLogout} />
        {expandedPlayerNode}
        <div className="app-body">
          <AdminSidebar page={page} setPage={setPage} user={user} />
          <div className="main-content">
            {allPages[page] || allPages["admin-overview"]}
          </div>
        </div>
        {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}
      </div>
    );
  }

  const defaultPage = user.role === "artist" ? "artist-dashboard" : "home";

  return (
    <div className="app-shell">
      <SessionBar user={user} roleLabel={roleLabel} onLogout={handleLogout} />
      {expandedPlayerNode}
      <div className="app-body">
        <MainSidebar page={page} setPage={setPage} user={user} />
        <div className="main-content">
          {allPages[page] || allPages[defaultPage]}
        </div>
      </div>
      <BottomPlayer
        track={currentTrack}
        onExpand={() => setExpandedPlayer(true)}
        volume={volume}
        setVolume={setVolume}
      />
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}
