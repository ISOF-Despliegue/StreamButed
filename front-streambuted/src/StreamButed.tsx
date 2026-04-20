import { useState, useEffect, useCallback, type ReactNode } from "react";
import "./index.css";
import "./App.css";

import { TRACKS } from "./data/mockData";
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

type Role = "listener" | "artist" | "admin";
type AuthPage = "login" | "register";

type AppUser = {
  email: string;
  role: Role;
  name: string;
};

type AppTrack = {
  id: string;
  duration: number;
  [key: string]: unknown;
};

type SessionBarProps = {
  user: AppUser;
  roleLabel: string;
  onLogout: () => void;
};

function SessionBar({ user, roleLabel, onLogout }: SessionBarProps) {
  return (
    <header className="session-bar">
      <div className="session-meta" aria-live="polite">
        Sesión activa: <strong>{user.name}</strong> · {roleLabel}
      </div>
      <LogoutButton onLogout={onLogout} />
    </header>
  );
}

export default function StreamButed() {
  const trackList = TRACKS as AppTrack[];

  // Auth state
  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [user, setUser] = useState<AppUser | null>(null);

  // App navigation
  const [page, setPage] = useState<string>("home");
  const [viewAlbum, setViewAlbum] = useState<string | null>(null);
  const [viewArtist, setViewArtist] = useState<string | null>(null);
  const [editTrack, setEditTrack] = useState<AppTrack | null>(null);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<AppTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [volume, setVolume] = useState<number>(72);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<boolean>(false);
  const [expandedPlayer, setExpandedPlayer] = useState<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  // Allows child components (e.g. SettingsPage) to promote the current user
  // to artist in real-time, without requiring a full re-login.
  const onUpdateUser = useCallback((updated: AppUser) => {
    setUser(updated);
    // Navigate to the artist dashboard after promotion so new
    // capabilities are immediately visible to the user.
    if (updated.role === "artist") {
      setPage("artist-dashboard");
    }
  }, []);

  // Simulate track progress
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    const id = window.setInterval(() => {
      setProgress((p: number) => {
        if (p >= currentTrack.duration) {
          setIsPlaying(false);
          return 0;
        }
        return p + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [isPlaying, currentTrack]);

  const playTrack = useCallback((t: AppTrack) => {
    setCurrentTrack(t);
    setIsPlaying(true);
    setProgress(0);
  }, []);

  const handleNext = () => {
    if (!currentTrack) return;
    const i = trackList.findIndex((t: AppTrack) => t.id === currentTrack.id);
    if (i >= 0 && i < trackList.length - 1) playTrack(trackList[i + 1]);
  };

  const handlePrev = () => {
    if (!currentTrack) return;
    if (progress > 5) {
      setProgress(0);
      return;
    }
    const i = trackList.findIndex((t: AppTrack) => t.id === currentTrack.id);
    if (i > 0) playTrack(trackList[i - 1]);
  };

  // Role is read from the JWT payload — no manual role selection at login.
  const handleLogin = (u: AppUser) => {
    setUser(u);
    
    // Admins land on their dedicated overview; all other users start on home.
    setPage(u.role === "admin" ? "admin-overview" : "home");

    // Reset navigation and player state on new login
    setViewAlbum(null);
    setViewArtist(null);
    setEditTrack(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setExpandedPlayer(false);
  };

  const handleLogout = () => {
    setUser(null);
    setAuthPage("login");
    setPage("home");
    setViewAlbum(null);
    setViewArtist(null);
    setEditTrack(null);
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setExpandedPlayer(false);
    setToastMsg(null);
  };

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
      <RegisterPage onLogin={handleLogin} onBack={() => setAuthPage("login")} />
    );
  }

  const roleLabel =
    user.role === "admin"
      ? "Administrador"
      : user.role === "artist"
      ? "Artista"
      : "Oyente";

  // Reusable expanded player node — identical for every role.
  const expandedPlayerNode =
    expandedPlayer && currentTrack ? (
      <ExpandedPlayer
        track={currentTrack}
        queue={trackList}
        isPlaying={isPlaying}
        onToggle={() => setIsPlaying((p: boolean) => !p)}
        onClose={() => setExpandedPlayer(false)}
        progress={progress}
        setProgress={setProgress}
        volume={volume}
        setVolume={setVolume}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        setRepeat={setRepeat}
        onNext={handleNext}
        onPrev={handlePrev}
        onSelectTrack={playTrack}
      />
    ) : null;

  // Unified page registry — roles are not branched here; the sidebar
  // controls which items are visible per role.
  const allPages: Record<string, ReactNode> = {
    // ── Discover (all roles) ─────────────────────────────────────────
    home: (
      <HomePage
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
        setViewArtist={setViewArtist}
      />
    ),
    search: (
      <SearchPage
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
        setViewArtist={setViewArtist}
      />
    ),
    library: (
      <div className="page-inner">
        <div className="page-title">Biblioteca</div>
        <div className="empty-state">
          <div className="empty-icon">🎵</div>
          <div className="empty-text">Tu biblioteca está vacía</div>
          <div className="empty-sub">
            Guarda álbumes y pistas para verlos aquí
          </div>
        </div>
      </div>
    ),
    lives: (
      <div className="page-inner">
        <div className="page-title">Lives</div>
        <div className="empty-state">
          <div className="empty-icon">🔴</div>
          <div className="empty-text">No hay lives activos ahora</div>
        </div>
      </div>
    ),
    "album-detail": (
      <AlbumDetailPage
        albumId={viewAlbum}
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewArtist={setViewArtist}
      />
    ),
    "artist-profile": (
      <ArtistProfilePage
        artistId={viewArtist}
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
      />
    ),

    // ── Artist management ────────────────────────────────────────────
    "artist-dashboard": (
      <ArtistDashboardPage
        user={user}
        onPlayTrack={playTrack}
        currentTrack={currentTrack}
        setPage={setPage}
      />
    ),
    "artist-tracks": (
      <MyTracksPage
        setPage={setPage}
        setEditTrack={setEditTrack}
        toast={toast}
      />
    ),
    "artist-upload": <UploadSinglePage toast={toast} />,
    "artist-album": <CreateAlbumPage toast={toast} />,
    "artist-edit-track": (
      <EditTrackPage track={editTrack} setPage={setPage} toast={toast} />
    ),
    "artist-analytics": <ArtistAnalyticsPage />,

    // ── Admin ────────────────────────────────────────────────────────
    "admin-overview": <AdminOverviewPage />,
    "admin-users": <AdminUsersPage toast={toast} />,
    "admin-content": (
      <div className="page-inner">
        <div className="page-title">Contenido</div>
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-text">Gestión de Contenido</div>
        </div>
      </div>
    ),
    "admin-reports": (
      <div className="page-inner">
        <div className="page-title">Reportes</div>
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-text">Reportes del Sistema</div>
        </div>
      </div>
    ),
    "admin-moderation": <AdminModerationPage toast={toast} />,

    // ── Shared ───────────────────────────────────────────────────────
    settings: (
      <SettingsPage user={user} toast={toast} onUpdateUser={onUpdateUser} />
    ),
  };

  // Admin uses its own dedicated sidebar.
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

  // Listeners and artists share the same shell — the unified MainSidebar
  // reveals Manage sections only when the user holds the artist role,
  // giving the experience of expanding capabilities rather than switching apps.
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
        isPlaying={isPlaying}
        onToggle={() => setIsPlaying((p: boolean) => !p)}
        onExpand={() => setExpandedPlayer(true)}
        progress={progress}
        setProgress={setProgress}
        volume={volume}
        setVolume={setVolume}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        setRepeat={setRepeat}
        onNext={handleNext}
        onPrev={handlePrev}
      />
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}