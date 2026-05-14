import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import "./index.css";
import "./App.css";

import { Toast } from "./components/ui/Toast";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { BottomPlayer } from "./components/layout/BottomPlayer";
import { ExpandedPlayer } from "./components/layout/ExpandedPlayer";
import { MainSidebar, AdminSidebar } from "./components/layout/Sidebars";
import LogoutButton from "./components/layout/LogoutButton";
import { GooglePasswordSetupPage, LoginPage, RegisterPage } from "./pages/AuthPages";
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
import { ArtistLiveRoom } from "./pages/live/ArtistLiveRoom";
import { LiveConcertsPage, type LiveRoom } from "./pages/live/LiveConcertsPage";
import { ListenerLiveRoom } from "./pages/live/ListenerLiveRoom";
import { RoleRoute } from "./routes/RoleRoute";
import { useAuth } from "./hooks/useAuth";
import { playbackService } from "./services/playbackService";
import { catalogService } from "./services/catalogService";
import { authService } from "./services/authService";
import type { CurrentUser } from "./types/user.types";
import type { Track } from "./types/catalog.types";
import type { PlaybackProgressRequest } from "./types/playback.types";

type AuthPage = "login" | "register";

type AppTrack = Track & {
  id?: string;
  artist?: string;
  artistName?: string;
  duration?: number;
  plays?: number;
};

type PlaybackSourceType = "single" | "album";

type PlaybackQueueState = {
  sourceType: PlaybackSourceType;
  albumId: string | null;
  tracks: AppTrack[];
  currentTrackId: string | null;
  currentIndex: number;
  shuffleEnabled: boolean;
  shuffledTrackIds: string[];
};

type PlaybackState = {
  isPlaying: boolean;
  isLoading: boolean;
  positionSeconds: number;
  durationSeconds: number;
  error: string;
  canUseAlbumControls: boolean;
  shuffleEnabled: boolean;
};

const EMPTY_QUEUE: PlaybackQueueState = {
  sourceType: "single",
  albumId: null,
  tracks: [],
  currentTrackId: null,
  currentIndex: 0,
  shuffleEnabled: false,
  shuffledTrackIds: [],
};

function getTrackIdentifier(track: AppTrack | null | undefined): string {
  return track?.trackId ?? track?.id ?? "";
}

function buildSingleQueue(track: AppTrack): PlaybackQueueState {
  return {
    sourceType: "single",
    albumId: null,
    tracks: [track],
    currentTrackId: getTrackIdentifier(track),
    currentIndex: 0,
    shuffleEnabled: false,
    shuffledTrackIds: [],
  };
}

function buildAlbumQueue(
  albumId: string,
  tracks: AppTrack[],
  track: AppTrack
): PlaybackQueueState {
  const currentTrackId = getTrackIdentifier(track);
  const currentIndex = Math.max(
    0,
    tracks.findIndex((item) => getTrackIdentifier(item) === currentTrackId)
  );

  return {
    sourceType: "album",
    albumId,
    tracks,
    currentTrackId,
    currentIndex,
    shuffleEnabled: false,
    shuffledTrackIds: [],
  };
}

function shuffleRemainingTrackIds(tracks: AppTrack[], currentTrackId: string): string[] {
  const remaining = tracks
    .map(getTrackIdentifier)
    .filter((trackId) => trackId && trackId !== currentTrackId);

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }

  return [currentTrackId, ...remaining];
}

function getQueueOrder(queue: PlaybackQueueState): string[] {
  if (queue.shuffleEnabled && queue.shuffledTrackIds.length > 0) {
    return queue.shuffledTrackIds;
  }

  return queue.tracks.map(getTrackIdentifier).filter(Boolean);
}

async function attachArtistName(track: AppTrack): Promise<AppTrack> {
  try {
    const artist = await catalogService.getArtist(track.artistId);
    return { ...track, artist: artist.displayName };
  } catch {
    return { ...track, artist: track.artist ?? track.artistName ?? "Artista" };
  }
}

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

type PlaybackControllerHandle = {
  playSingleTrack: (track: AppTrack) => void;
  playAlbumTrack: (track: AppTrack, tracks: AppTrack[], albumId: string) => void;
  saveCurrentProgress: (isPlayingOverride?: boolean | null) => Promise<void>;
  reset: () => void;
};

type PlaybackControllerProps = {
  user: CurrentUser;
  currentTrack: AppTrack | null;
  playbackQueue: PlaybackQueueState;
  setCurrentTrack: (track: AppTrack | null) => void;
  setPlaybackQueue: Dispatch<SetStateAction<PlaybackQueueState>>;
  toast: (msg: string) => void;
};

const PlaybackController = forwardRef<PlaybackControllerHandle, PlaybackControllerProps>(
  function PlaybackController(
    { user, currentTrack, playbackQueue, setCurrentTrack, setPlaybackQueue, toast },
    ref
  ) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
    const [playbackPositionSeconds, setPlaybackPositionSeconds] = useState(0);
    const [playbackDurationSeconds, setPlaybackDurationSeconds] = useState(0);
    const [playbackError, setPlaybackError] = useState("");
    const [volume, setVolume] = useState<number>(72);
    const [expandedPlayer, setExpandedPlayer] = useState<boolean>(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackRef = useRef<AppTrack | null>(null);
    const playbackQueueRef = useRef<PlaybackQueueState>(EMPTY_QUEUE);
    const pendingSeekSecondsRef = useRef<number | null>(null);
    const lastProgressSyncAtRef = useRef(0);
    const playbackRequestIdRef = useRef(0);

    useEffect(() => {
      currentTrackRef.current = currentTrack;
    }, [currentTrack]);

    useEffect(() => {
      playbackQueueRef.current = playbackQueue;
    }, [playbackQueue]);

    useEffect(() => {
      if (audioRef.current) {
        audioRef.current.volume = volume / 100;
      }
    }, [volume]);

    const saveCurrentProgress = useCallback(async (isPlayingOverride?: boolean | null) => {
      const track = currentTrackRef.current;
      const audio = audioRef.current;
      const trackId = getTrackIdentifier(track);

      if (!trackId || !audio) {
        return;
      }

      const positionSeconds = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const durationSeconds = Number.isFinite(audio.duration) ? audio.duration : null;

      try {
        const progressPayload: PlaybackProgressRequest = {
          positionSeconds,
          durationSeconds,
        };

        if (typeof isPlayingOverride === "boolean") {
          progressPayload.isPlaying = isPlayingOverride;
        }

        await playbackService.updatePlaybackProgress(trackId, progressPayload);
      } catch (error) {
        console.error("Failed to persist playback progress.", error);
      }
    }, []);

    const startPlayback = useCallback(
      async (track: AppTrack, nextQueue: PlaybackQueueState, saveCurrent = true) => {
        const trackId = getTrackIdentifier(track);
        if (!trackId) {
          toast("La pista no tiene un identificador valido.");
          return;
        }

        const requestId = playbackRequestIdRef.current + 1;
        playbackRequestIdRef.current = requestId;

        if (saveCurrent) {
          await saveCurrentProgress(false);
        }

        setCurrentTrack(track);
        setPlaybackQueue(nextQueue);
        setPlaybackError("");
        setIsPlaybackLoading(true);
        setIsPlaying(false);
        setPlaybackPositionSeconds(0);
        setPlaybackDurationSeconds(0);

        try {
          const [session, progress] = await Promise.all([
            playbackService.createStreamSession(trackId),
            playbackService.getPlaybackProgress(trackId),
          ]);

          if (playbackRequestIdRef.current !== requestId) {
            return;
          }

          const audio = audioRef.current;
          if (!audio) {
            return;
          }

          pendingSeekSecondsRef.current =
            progress.positionSeconds > 0 ? progress.positionSeconds : null;
          setPlaybackPositionSeconds(progress.positionSeconds ?? 0);
          setPlaybackDurationSeconds(progress.durationSeconds ?? 0);
          audio.src = session.streamUrl;
          audio.volume = volume / 100;
          audio.load();
          lastProgressSyncAtRef.current = Date.now();

          try {
            await audio.play();
            if (playbackRequestIdRef.current === requestId) {
              setIsPlaying(true);
              await playbackService.updatePlaybackProgress(trackId, {
                positionSeconds: Number.isFinite(audio.currentTime)
                  ? audio.currentTime
                  : (progress.positionSeconds ?? 0),
                durationSeconds: Number.isFinite(audio.duration)
                  ? audio.duration
                  : (progress.durationSeconds ?? null),
                isPlaying: true,
              });
            }
          } catch (playError) {
            console.error("Audio playback failed to start.", playError);
            setPlaybackError("Presiona play para continuar la reproduccion.");
          }
        } catch (error) {
          console.error("Failed to start playback.", error);
          if (playbackRequestIdRef.current === requestId) {
            setPlaybackError("No se pudo iniciar la reproduccion.");
            toast("No se pudo iniciar la reproduccion de esta pista.");
          }
        } finally {
          if (playbackRequestIdRef.current === requestId) {
            setIsPlaybackLoading(false);
          }
        }
      },
      [saveCurrentProgress, setCurrentTrack, setPlaybackQueue, toast, volume]
    );

    const playSingleTrack = useCallback(
      (track: AppTrack) => {
        void startPlayback(track, buildSingleQueue(track));
      },
      [startPlayback]
    );

    const playAlbumTrack = useCallback(
      (track: AppTrack, tracks: AppTrack[], albumId: string) => {
        void startPlayback(track, buildAlbumQueue(albumId, tracks, track));
      },
      [startPlayback]
    );

    const playQueueTrackById = useCallback(
      async (trackId: string, saveCurrent = true) => {
        const queue = playbackQueueRef.current;
        const track = queue.tracks.find((item) => getTrackIdentifier(item) === trackId);
        if (!track) {
          return;
        }

        const currentIndex = Math.max(
          0,
          queue.tracks.findIndex((item) => getTrackIdentifier(item) === trackId)
        );
        await startPlayback(
          track,
          {
            ...queue,
            currentTrackId: trackId,
            currentIndex,
          },
          saveCurrent
        );
      },
      [startPlayback]
    );

    const getAdjacentTrackId = useCallback((direction: 1 | -1): string | null => {
      const queue = playbackQueueRef.current;
      const order = getQueueOrder(queue);
      if (queue.sourceType !== "album" || order.length <= 1 || !queue.currentTrackId) {
        return null;
      }

      const currentOrderIndex = Math.max(0, order.indexOf(queue.currentTrackId));
      const nextIndex = (currentOrderIndex + direction + order.length) % order.length;
      const nextTrackId = order[nextIndex];

      if (nextTrackId === queue.currentTrackId && order.length > 1) {
        return order[(nextIndex + direction + order.length) % order.length];
      }

      return nextTrackId;
    }, []);

    const handleNextTrack = useCallback(() => {
      const nextTrackId = getAdjacentTrackId(1);
      if (nextTrackId) {
        void playQueueTrackById(nextTrackId);
      }
    }, [getAdjacentTrackId, playQueueTrackById]);

    const handlePreviousTrack = useCallback(() => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 3) {
        audio.currentTime = 0;
        setPlaybackPositionSeconds(0);
        void saveCurrentProgress(isPlaying);
        return;
      }

      const previousTrackId = getAdjacentTrackId(-1);
      if (previousTrackId) {
        void playQueueTrackById(previousTrackId);
      }
    }, [getAdjacentTrackId, isPlaying, playQueueTrackById, saveCurrentProgress]);

    const handleToggleShuffle = useCallback(() => {
      setPlaybackQueue((queue) => {
        if (queue.sourceType !== "album" || queue.tracks.length <= 1 || !queue.currentTrackId) {
          return queue;
        }

        if (queue.shuffleEnabled) {
          return {
            ...queue,
            currentIndex: Math.max(
              0,
              queue.tracks.findIndex((track) => getTrackIdentifier(track) === queue.currentTrackId)
            ),
            shuffleEnabled: false,
            shuffledTrackIds: [],
          };
        }

        return {
          ...queue,
          shuffleEnabled: true,
          shuffledTrackIds: shuffleRemainingTrackIds(queue.tracks, queue.currentTrackId),
        };
      });
    }, [setPlaybackQueue]);

    const handleTogglePlay = useCallback(async () => {
      const audio = audioRef.current;
      const track = currentTrackRef.current;

      if (!track) {
        return;
      }

      if (!audio?.src) {
        const queue = playbackQueueRef.current.tracks.length
          ? playbackQueueRef.current
          : buildSingleQueue(track);
        await startPlayback(track, queue, false);
        return;
      }

      if (audio.paused) {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (error) {
          console.error("Audio playback failed.", error);
          setPlaybackError("No se pudo continuar la reproduccion.");
          toast("No se pudo continuar la reproduccion.");
        }
        return;
      }

      audio.pause();
    }, [startPlayback, toast]);

    const handleSeek = useCallback(
      (positionSeconds: number) => {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        audio.currentTime = Math.max(0, positionSeconds);
        setPlaybackPositionSeconds(audio.currentTime);
        void saveCurrentProgress(isPlaying);
      },
      [isPlaying, saveCurrentProgress]
    );

    const refreshAudioDuration = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      const durationSeconds = Number.isFinite(audio.duration) ? audio.duration : 0;
      setPlaybackDurationSeconds(durationSeconds);

      const pendingSeekSeconds = pendingSeekSecondsRef.current;
      if (pendingSeekSeconds !== null && durationSeconds > 0) {
        audio.currentTime = Math.min(pendingSeekSeconds, Math.max(0, durationSeconds - 1));
        setPlaybackPositionSeconds(audio.currentTime);
        pendingSeekSecondsRef.current = null;
      }
    }, []);

    const handleLoadedMetadata = useCallback(() => {
      refreshAudioDuration();
    }, [refreshAudioDuration]);

    const handleDurationChange = useCallback(() => {
      refreshAudioDuration();
    }, [refreshAudioDuration]);

    const handleTimeUpdate = useCallback(() => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      setPlaybackPositionSeconds(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      if (Number.isFinite(audio.duration)) {
        setPlaybackDurationSeconds(audio.duration);
      }

      const now = Date.now();
      if (now - lastProgressSyncAtRef.current >= 10000) {
        lastProgressSyncAtRef.current = now;
        void saveCurrentProgress(true);
      }
    }, [saveCurrentProgress]);

    const handleAudioPause = useCallback(() => {
      const audio = audioRef.current;
      if (audio?.ended) {
        return;
      }

      setIsPlaying(false);
      void saveCurrentProgress(false);
    }, [saveCurrentProgress]);

    const handleAudioEnded = useCallback(async () => {
      setIsPlaying(false);
      await saveCurrentProgress(false);

      const nextTrackId = getAdjacentTrackId(1);
      if (nextTrackId) {
        await playQueueTrackById(nextTrackId, false);
      }
    }, [getAdjacentTrackId, playQueueTrackById, saveCurrentProgress]);

    const handleAudioError = useCallback(() => {
      if (!currentTrackRef.current) {
        return;
      }

      setIsPlaying(false);
      setIsPlaybackLoading(false);
      setPlaybackError("No se pudo reproducir el audio.");
      toast("No se pudo reproducir el audio.");
    }, [toast]);

    const reset = useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      setIsPlaying(false);
      setIsPlaybackLoading(false);
      setPlaybackPositionSeconds(0);
      setPlaybackDurationSeconds(0);
      setPlaybackError("");
      setExpandedPlayer(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        playSingleTrack,
        playAlbumTrack,
        saveCurrentProgress,
        reset,
      }),
      [playAlbumTrack, playSingleTrack, reset, saveCurrentProgress]
    );

    useEffect(() => {
      if (!user || user.role === "admin") {
        return undefined;
      }

      let mounted = true;

      const loadLatestPlayback = async () => {
        try {
          const progress = await playbackService.getLatestPlaybackProgress();
          if (!mounted || !progress.trackId || currentTrackRef.current) {
            return;
          }

          const track = await catalogService.getTrack(progress.trackId);
          const enrichedTrack = await attachArtistName(track);
          if (!mounted || currentTrackRef.current) {
            return;
          }

          setCurrentTrack(enrichedTrack);
          setPlaybackQueue(buildSingleQueue(enrichedTrack));
          setPlaybackPositionSeconds(progress.positionSeconds ?? 0);
          setPlaybackDurationSeconds(progress.durationSeconds ?? 0);
          setPlaybackError("");
          setIsPlaying(false);
          setIsPlaybackLoading(false);
        } catch (error) {
          console.error("Failed to load latest playback into player.", error);
        }
      };

      void loadLatestPlayback();

      return () => {
        mounted = false;
      };
    }, [setCurrentTrack, setPlaybackQueue, user]);

    const canUseAlbumControls =
      playbackQueue.sourceType === "album" && playbackQueue.tracks.length > 1;

    const playbackState: PlaybackState = {
      isPlaying,
      isLoading: isPlaybackLoading,
      positionSeconds: playbackPositionSeconds,
      durationSeconds: playbackDurationSeconds,
      error: playbackError,
      canUseAlbumControls,
      shuffleEnabled: playbackQueue.shuffleEnabled,
    };

    const expandedPlayerNode =
      expandedPlayer && currentTrack ? (
        <ExpandedPlayer
          track={currentTrack}
          queue={playbackQueue.tracks.length ? playbackQueue.tracks : [currentTrack]}
          onClose={() => setExpandedPlayer(false)}
          volume={volume}
          setVolume={setVolume}
          playback={playbackState}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onNext={handleNextTrack}
          onPrevious={handlePreviousTrack}
          onToggleShuffle={handleToggleShuffle}
          onSelectTrack={(trackToSelect: AppTrack) => {
            const trackId = getTrackIdentifier(trackToSelect);
            if (playbackQueue.sourceType === "album" && trackId) {
              void playQueueTrackById(trackId);
              return;
            }
            playSingleTrack(trackToSelect);
          }}
        />
      ) : null;

    return (
      <>
        {expandedPlayerNode}
        <BottomPlayer
          track={currentTrack}
          onExpand={() => setExpandedPlayer(true)}
          volume={volume}
          setVolume={setVolume}
          playback={playbackState}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onNext={handleNextTrack}
          onPrevious={handlePreviousTrack}
          onToggleShuffle={handleToggleShuffle}
        />
        <audio
          ref={audioRef}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onDurationChange={handleDurationChange}
          onTimeUpdate={handleTimeUpdate}
          onPause={handleAudioPause}
          onEnded={handleAudioEnded}
          onError={handleAudioError}
        />
      </>
    );
  }
);

export default function StreamButed() {
  const {
    user,
    isLoadingSession,
    login,
    startRegistration,
    verifyRegistration,
    resendRegistrationCode,
    cancelRegistration,
    completeGooglePasswordSetup,
    logout,
  } = useAuth();

  const [authPage, setAuthPage] = useState<AuthPage>("login");
  const [page, setPage] = useState<string>("home");
  const [viewAlbum, setViewAlbum] = useState<string | null>(null);
  const [viewArtist, setViewArtist] = useState<string | null>(null);
  const [editTrack, setEditTrack] = useState<AppTrack | null>(null);
  const [uploadAlbumId, setUploadAlbumId] = useState<string | null>(null);
  const [selectedLiveRoom, setSelectedLiveRoom] = useState<LiveRoom | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AppTrack | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackQueueState>(EMPTY_QUEUE);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [oauthStatus, setOauthStatus] = useState("");

  const playbackControllerRef = useRef<PlaybackControllerHandle | null>(null);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);

  const playSingleTrack = useCallback(
    (track: AppTrack) => {
      playbackControllerRef.current?.playSingleTrack(track);
    },
    []
  );

  const playAlbumTrack = useCallback(
    (track: AppTrack, tracks: AppTrack[], albumId: string) => {
      playbackControllerRef.current?.playAlbumTrack(track, tracks, albumId);
    },
    []
  );

  const resetNavigation = useCallback((nextUser: CurrentUser | null) => {
    playbackControllerRef.current?.reset();
    setPage(nextUser?.role === "admin" ? "admin-overview" : "home");
    setViewAlbum(null);
    setViewArtist(null);
    setEditTrack(null);
    setUploadAlbumId(null);
    setSelectedLiveRoom(null);
    setCurrentTrack(null);
    setPlaybackQueue(EMPTY_QUEUE);
  }, []);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    const loggedUser = await login(credentials);
    resetNavigation(loggedUser);
  };

  const handleRegister = async (request: { email: string; username: string; password: string }) => {
    return startRegistration(request);
  };

  const handleVerifyRegistration = async (request: {
    attemptId: string;
    email: string;
    code: string;
  }) => {
    const registeredUser = await verifyRegistration(request);
    resetNavigation(registeredUser);
  };

  const handleGoogleAuth = (mode: "login" | "register") => {
    window.location.assign(authService.getGoogleAuthUrl(mode));
  };

  const handleCompleteGooglePasswordSetup = async (request: {
    password: string;
    confirmPassword: string;
  }) => {
    const updatedUser = await completeGooglePasswordSetup(request);
    setOauthStatus("");
    setOauthError("");
    resetNavigation(updatedUser);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("oauth");
    if (!oauthStatus) return;

    setOauthStatus(oauthStatus);
    if (oauthStatus === "google-error") {
      setOauthError(params.get("message") || "No se pudo completar Google OAuth.");
    } else if (oauthStatus === "google-password-setup") {
      setOauthError("Completa tu password para terminar el registro con Google.");
    } else {
      setOauthError("");
    }

    params.delete("oauth");
    params.delete("message");
    const nextSearch = params.toString();
    const nextUrl = [
      window.location.pathname,
      nextSearch ? `?${nextSearch}` : "",
      window.location.hash,
    ].join("");
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await playbackControllerRef.current?.saveCurrentProgress(false);
      await logout();
      setAuthPage("login");
      resetNavigation(null);
      setToastMsg(null);
      setShowLogoutConfirmation(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

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
          onGoogleLogin={() => handleGoogleAuth("login")}
          externalError={oauthError}
        />
      );
    }

    return (
      <RegisterPage
        onStartRegistration={handleRegister}
        onVerifyRegistration={handleVerifyRegistration}
        onResendCode={resendRegistrationCode}
        onCancelVerification={cancelRegistration}
        onGoogleRegister={() => handleGoogleAuth("register")}
        onBack={() => setAuthPage("login")}
        externalError={oauthError}
      />
    );
  }

  if (user.passwordSetupRequired) {
    return (
      <GooglePasswordSetupPage
        email={user.email}
        onSubmit={handleCompleteGooglePasswordSetup}
        externalError={oauthStatus === "google-password-setup" ? oauthError : ""}
      />
    );
  }

  const roleLabel =
    user.role === "admin"
      ? "Administrador"
      : user.role === "artist"
      ? "Artista"
      : "Oyente";

  const allPages: Record<string, ReactNode> = {
    home: (
      <HomePage
        setPage={setPage}
      />
    ),
    search: (
      <SearchPage
        onPlayTrack={playSingleTrack}
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
      <LiveConcertsPage
        userRole={user.role}
        onJoinRoom={(room) => {
          setSelectedLiveRoom(room);
          setPage("listener-live");
        }}
        onStartBroadcast={() => setPage("artist-live")}
      />
    ),
    "artist-live": (
      <RoleRoute allowedRoles={["artist"]}>
        <ArtistLiveRoom />
      </RoleRoute>
    ),
    "listener-live": selectedLiveRoom ? (
      <ListenerLiveRoom
        roomId={selectedLiveRoom.id}
        concertTitle={selectedLiveRoom.title}
        artistName={selectedLiveRoom.artistName || selectedLiveRoom.artistId}
        onLeave={() => {
          setSelectedLiveRoom(null);
          setPage("lives");
        }}
      />
    ) : (
      <LiveConcertsPage
        userRole={user.role}
        onJoinRoom={(room) => {
          setSelectedLiveRoom(room);
          setPage("listener-live");
        }}
        onStartBroadcast={() => setPage("artist-live")}
      />
    ),
    "album-detail": (
      <AlbumDetailPage
        albumId={viewAlbum}
        onPlayTrack={playAlbumTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewArtist={setViewArtist}
      />
    ),
    "artist-profile": (
      <ArtistProfilePage
        artistId={viewArtist}
        onPlayTrack={playSingleTrack}
        currentTrack={currentTrack}
        setPage={setPage}
        setViewAlbum={setViewAlbum}
      />
    ),
    "artist-dashboard": (
      <RoleRoute allowedRoles={["artist"]}>
        <ArtistDashboardPage user={user} onPlayTrack={playSingleTrack} currentTrack={currentTrack} setPage={setPage} />
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
        <SessionBar user={user} roleLabel={roleLabel} onLogout={() => setShowLogoutConfirmation(true)} />
        <div className="app-body">
          <AdminSidebar page={page} setPage={setPage} user={user} />
          <div className="main-content">
            {allPages[page] || allPages["admin-overview"]}
          </div>
        </div>
        <ConfirmDialog
          open={showLogoutConfirmation}
          title="Cerrar sesion"
          message="Se guardara el progreso de reproduccion actual y volveras a la pantalla de inicio de sesion."
          confirmLabel="Cerrar sesion"
          tone="primary"
          isLoading={isLoggingOut}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirmation(false)}
        />
        {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}
      </div>
    );
  }

  const defaultPage = user.role === "artist" ? "artist-dashboard" : "home";

  return (
    <div className="app-shell">
      <SessionBar user={user} roleLabel={roleLabel} onLogout={() => setShowLogoutConfirmation(true)} />
      <div className="app-body">
        <MainSidebar page={page} setPage={setPage} user={user} />
        <div className="main-content">
          {allPages[page] || allPages[defaultPage]}
        </div>
      </div>
      <PlaybackController
        ref={playbackControllerRef}
        user={user}
        currentTrack={currentTrack}
        playbackQueue={playbackQueue}
        setCurrentTrack={setCurrentTrack}
        setPlaybackQueue={setPlaybackQueue}
        toast={toast}
      />
      <ConfirmDialog
        open={showLogoutConfirmation}
        title="Cerrar sesion"
        message="Se guardara el progreso de reproduccion actual y volveras a la pantalla de inicio de sesion."
        confirmLabel="Cerrar sesion"
        tone="primary"
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
      {toastMsg && <Toast msg={toastMsg} onDone={() => setToastMsg(null)} />}
    </div>
  );
}
