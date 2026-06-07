import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import "./index.css";
import "./App.css";

import { Toast } from "./components/ui/Toast";
import { ConfirmDialog } from "./components/ui/ConfirmDialog";
import { BottomPlayer } from "./components/layout/BottomPlayer";
import { ExpandedPlayer } from "./components/layout/ExpandedPlayer";
import { MobileTabBar, ResponsiveAppShell, type MobileNavItem } from "./components/layout/ResponsiveAppShell";
import { MainSidebar, AdminSidebar } from "./components/layout/Sidebars";
import { IcCamera, IcHome, IcLib, IcOverview, IcReport, IcSearch, IcSettings, IcShield } from "./components/icons/Icons";
import { GooglePasswordSetupPage, LoginPage, RegisterPage } from "./pages/AuthPages";
import { SettingsPage } from "./pages/SettingsPage";
import {
  HomePage,
  SearchPage,
  AlbumDetailPage,
  ArtistProfilePage,
  ArtistDiscographyPage,
} from "./pages/listener/ListenerPages";
import { LibraryPage, PlaylistDetailPage } from "./pages/listener/LibraryPage";
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
  AdminAnalyticsPage,
  AdminOverviewPage,
  AdminModerationPage,
} from "./pages/admin/AdminPages";
import { ArtistLiveRoom } from "./pages/live/ArtistLiveRoom";
import { LiveConcertsPage, type LiveRoom } from "./pages/live/LiveConcertsPage";
import { ListenerLiveRoom } from "./pages/live/ListenerLiveRoom";
import { RoleRoute } from "./routes/RoleRoute";
import { routePatterns, routes } from "./routes/appRoutes";
import { getAssetUrl } from "./services/mediaService";
import { useAuth } from "./hooks/useAuth";
import { useIsMobileViewport } from "./hooks/useIsMobileViewport";
import { playbackService } from "./services/playbackService";
import { catalogService } from "./services/catalogService";
import { libraryService } from "./services/libraryService";
import { emitLikedSongsChanged, subscribeToLibraryEvents } from "./services/libraryEvents";
import { SESSION_TERMINATED_EVENT } from "./services/apiClient";
import { authService } from "./services/authService";
import { browserLogger } from "./utils/browserLogger";
import { getSecureRandomInt } from "./utils/secureRandom";
import { toUserFacingMessage } from "./utils/userFacingMessages";
import {
  buildAlbumQueue,
  buildSingleQueue,
  getNextQueueTrackId,
  getPreviousQueueTrackId,
  getTrackIdentifier,
  type PlaybackQueueState as PlaybackQueueStateBase,
} from "./utils/playbackQueue";
import type { CurrentUser } from "./types/user.types";
import type { Track } from "./types/catalog.types";
import type { PlaybackProgressRequest, StreamSessionResponse } from "./types/playback.types";

type AppTrack = Track & {
  id?: string;
  artist?: string;
  artistName?: string;
  duration?: number;
  plays?: number;
};

type PlaybackQueueState = PlaybackQueueStateBase<AppTrack>;

type PlaybackState = {
  isPlaying: boolean;
  isLoading: boolean;
  positionSeconds: number;
  durationSeconds: number;
  error: string;
  canUseAlbumControls: boolean;
  repeatEnabled: boolean;
  shuffleEnabled: boolean;
};

type CurrentTrackLikeState = {
  trackId: string | null;
  isLiked: boolean;
  isLoading: boolean;
};

type PlaybackSessionCache = StreamSessionResponse;

const EMPTY_QUEUE: PlaybackQueueState = {
  sourceType: "single",
  albumId: null,
  tracks: [],
  currentTrackId: null,
  currentIndex: 0,
  shuffleEnabled: false,
  shuffledTrackIds: [],
};

function shuffleRemainingTrackIds(tracks: AppTrack[], currentTrackId: string): string[] {
  const remaining = tracks
    .map(getTrackIdentifier)
    .filter((trackId) => trackId && trackId !== currentTrackId);

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = getSecureRandomInt(index + 1);
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }

  return [currentTrackId, ...remaining];
}

async function attachArtistName(track: AppTrack): Promise<AppTrack> {
  try {
    const artist = await catalogService.getArtist(track.artistId);
    return { ...track, artist: artist.displayName };
  } catch (error) {
    browserLogger.warn("Failed to load artist name for playback track. Using fallback value.", error);
    return { ...track, artist: track.artist ?? track.artistName ?? "Artista" };
  }
}

function NotAvailableState({ title, message }: Readonly<{ title: string; message: string }>) {
  return (
    <div className="page-inner">
      <div className="page-title">{title}</div>
      <div className="empty-state">
        <div className="empty-text">Esta sección aún no está disponible</div>
        <div className="empty-sub">{message}</div>
      </div>
    </div>
  );
}

const DESKTOP_AUTH_PENDING_KEY = "streambuted:desktop-auth:pending";
const DESKTOP_AUTH_REDIRECT_URI = "streambuted://auth/callback";
const DESKTOP_AUTH_STATE_PATTERN = /^[A-Za-z0-9_-]{16,512}$/;
const DESKTOP_AUTH_PENDING_TTL_MS = 5 * 60 * 1000;

type PendingDesktopAuth = {
  state: string;
  createdAt: number;
};

function parsePendingDesktopAuth(rawValue: string | null): PendingDesktopAuth | null {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue) as PendingDesktopAuth;
    if (!DESKTOP_AUTH_STATE_PATTERN.test(parsed.state) || typeof parsed.createdAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isPendingDesktopAuthExpired(pending: PendingDesktopAuth): boolean {
  return Date.now() - pending.createdAt > DESKTOP_AUTH_PENDING_TTL_MS;
}

export function readPendingDesktopAuth(): PendingDesktopAuth | null {
  const parsed = parsePendingDesktopAuth(globalThis.window.sessionStorage.getItem(DESKTOP_AUTH_PENDING_KEY));
  if (!parsed || isPendingDesktopAuthExpired(parsed)) {
    clearPendingDesktopAuth();
    return null;
  }
  return parsed;
}

function savePendingDesktopAuth(state: string): boolean {
  const existingPending = parsePendingDesktopAuth(globalThis.window.sessionStorage.getItem(DESKTOP_AUTH_PENDING_KEY));
  if (existingPending && existingPending.state === state) {
    if (isPendingDesktopAuthExpired(existingPending)) {
      clearPendingDesktopAuth();
      return false;
    }
    return true;
  }

  globalThis.window.sessionStorage.setItem(
    DESKTOP_AUTH_PENDING_KEY,
    JSON.stringify({ state, createdAt: Date.now() })
  );
  return true;
}

function clearPendingDesktopAuth(): void {
  globalThis.window.sessionStorage.removeItem(DESKTOP_AUTH_PENDING_KEY);
}

type DesktopLaunchOutcome = "idle" | "success" | "cancelled";

function DesktopAuthStartPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [message, setMessage] = useState("Preparando autenticación desktop...");
  const [error, setError] = useState("");
  const launchOutcomeTimeoutRef = useRef<number | null>(null);
  const launchVisibilityHandledRef = useRef(false);
  const removeLaunchListenersRef = useRef<(() => void) | null>(null);
  const state = searchParams.get("state")?.trim() ?? "";
  const provider = searchParams.get("provider")?.trim().toLowerCase() ?? "";
  const mode = searchParams.get("mode") === "register" ? "register" : "login";

  const clearLaunchOutcomeTimeout = useCallback(() => {
    if (launchOutcomeTimeoutRef.current !== null) {
      globalThis.clearTimeout(launchOutcomeTimeoutRef.current);
      launchOutcomeTimeoutRef.current = null;
    }
  }, []);

  const clearLaunchListeners = useCallback(() => {
    removeLaunchListenersRef.current?.();
    removeLaunchListenersRef.current = null;
  }, []);

  const updateLaunchOutcome = useCallback((outcome: DesktopLaunchOutcome) => {
    clearLaunchListeners();
    clearLaunchOutcomeTimeout();
    setError("");
    if (outcome === "success") {
      setMessage("Ya puedes cerrar esta ventana");
      return;
    }

    if (outcome === "cancelled") {
      setMessage("Inicio de sesión cancelado");
      return;
    }

    setMessage("Conectando con StreamButed Desktop");
  }, [clearLaunchListeners, clearLaunchOutcomeTimeout]);

  const openDesktopCallback = useCallback((callbackUrl: string) => {
    clearLaunchListeners();
    clearLaunchOutcomeTimeout();
    launchVisibilityHandledRef.current = false;
    setError("");
    setMessage("Conectando con StreamButed Desktop");

    const markDesktopLaunchAccepted = () => {
      if (document.hidden || !document.hasFocus()) {
        launchVisibilityHandledRef.current = true;
        updateLaunchOutcome("success");
      }
    };

    const handleVisibilityChange = () => {
      markDesktopLaunchAccepted();
    };
    const handleWindowBlur = () => {
      markDesktopLaunchAccepted();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    globalThis.addEventListener("blur", handleWindowBlur);
    removeLaunchListenersRef.current = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      globalThis.removeEventListener("blur", handleWindowBlur);
    };
    launchOutcomeTimeoutRef.current = globalThis.setTimeout(() => {
      updateLaunchOutcome(launchVisibilityHandledRef.current ? "success" : "cancelled");
    }, 1600);

    globalThis.window.location.assign(callbackUrl);
  }, [clearLaunchListeners, clearLaunchOutcomeTimeout, updateLaunchOutcome]);

  useEffect(() => {
    if (!DESKTOP_AUTH_STATE_PATTERN.test(state)) {
      setError("La solicitud de autenticación desktop no es valida.");
      return;
    }

    if (!savePendingDesktopAuth(state)) {
      setError("La solicitud de autenticación desktop expiro. Intenta iniciar sesión desde la app de escritorio nuevamente.");
      return;
    }

    if (provider === "google") {
      globalThis.window.location.assign(authService.getGoogleAuthUrl(mode));
      return;
    }

    if (!accessToken) {
      navigate(routes.login, { replace: true });
      return;
    }

    let mounted = true;
    setMessage("Conectando con StreamButed Desktop");
    authService
      .createDesktopHandoffCode({ state, redirectUri: DESKTOP_AUTH_REDIRECT_URI })
      .then((response) => {
        if (!mounted) return;
        clearPendingDesktopAuth();
        const callbackUrl = new URL(DESKTOP_AUTH_REDIRECT_URI);
        callbackUrl.searchParams.set("code", response.code);
        callbackUrl.searchParams.set("state", response.state);
        openDesktopCallback(callbackUrl.toString());
      })
      .catch((caughtError) => {
        if (!mounted) return;
        clearLaunchListeners();
        clearLaunchOutcomeTimeout();
        setError(toUserFacingMessage(caughtError instanceof Error ? caughtError.message : "No se pudo completar la autenticacion desktop."));
      });

    return () => {
      mounted = false;
      clearLaunchListeners();
      clearLaunchOutcomeTimeout();
    };
  }, [accessToken, clearLaunchListeners, clearLaunchOutcomeTimeout, mode, navigate, openDesktopCallback, provider, state]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"><div className="auth-logo-mark">S</div></div>
        <div className="auth-title">StreamButed Desktop</div>
        {error ? (
          <div className="form-error" role="alert">{error}</div>
        ) : (
          <div className="auth-sub">{message}</div>
        )}
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

type PlaybackControllerProps = Readonly<{
  user: CurrentUser;
  currentTrack: AppTrack | null;
  currentTrackLikeState: CurrentTrackLikeState;
  playbackQueue: PlaybackQueueState;
  onToggleCurrentTrackLike: () => void;
  setCurrentTrack: (track: AppTrack | null) => void;
  setPlaybackQueue: Dispatch<SetStateAction<PlaybackQueueState>>;
  toast: (msg: string) => void;
}>;

const PlaybackController = forwardRef<PlaybackControllerHandle, PlaybackControllerProps>(
  function PlaybackController(
    {
      user,
      currentTrack,
      currentTrackLikeState,
      playbackQueue,
      onToggleCurrentTrackLike,
      setCurrentTrack,
      setPlaybackQueue,
      toast,
    },
    ref
  ) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPlaybackLoading, setIsPlaybackLoading] = useState(false);
    const [playbackPositionSeconds, setPlaybackPositionSeconds] = useState(0);
    const [playbackDurationSeconds, setPlaybackDurationSeconds] = useState(0);
    const [playbackError, setPlaybackError] = useState("");
    const [volume, setVolume] = useState<number>(72);
    const [repeatEnabled, setRepeatEnabled] = useState<boolean>(false);
    const [expandedPlayer, setExpandedPlayer] = useState<boolean>(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const currentTrackRef = useRef<AppTrack | null>(null);
    const playbackQueueRef = useRef<PlaybackQueueState>(EMPTY_QUEUE);
    const pendingSeekSecondsRef = useRef<number | null>(null);
    const lastProgressSyncAtRef = useRef(0);
    const playbackRequestIdRef = useRef(0);
    const playbackSessionRef = useRef<PlaybackSessionCache | null>(null);
    const pendingResumeRecoveryTrackIdRef = useRef<string | null>(null);

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

    const cachePlaybackSession = useCallback((session: PlaybackSessionCache) => {
      playbackSessionRef.current = session;
    }, []);

    const canReusePlaybackSession = useCallback((trackId: string) => {
      const session = playbackSessionRef.current;
      if (!session || session.trackId !== trackId || !session.streamUrl?.trim()) {
        return false;
      }

      const expiresAt = Date.parse(session.expiresAt);
      if (Number.isNaN(expiresAt)) {
        return false;
      }

      return expiresAt - Date.now() > 5000;
    }, []);

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
        browserLogger.error("Failed to persist playback progress.", error);
      }
    }, []);

    const startPlayback = useCallback(
      async (
        track: AppTrack,
        nextQueue: PlaybackQueueState,
        saveCurrent = true,
        resumeProgress = true
      ) => {
        const trackId = getTrackIdentifier(track);
        if (!trackId) {
          toast("La pista no tiene un identificador válido.");
          return;
        }

        const previousTrack = currentTrack;
        const previousTrackId = getTrackIdentifier(previousTrack);
        const isSwitchAttempt = Boolean(previousTrackId && previousTrackId !== trackId);

        const requestId = playbackRequestIdRef.current + 1;
        playbackRequestIdRef.current = requestId;

        if (saveCurrent) {
          await saveCurrentProgress(false);
        }

        setIsPlaybackLoading(true);

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

          const restorePosition = resumeProgress ? (progress.positionSeconds ?? 0) : 0;
          setCurrentTrack(track);
          setPlaybackQueue(nextQueue);
          setPlaybackError("");
          setIsPlaying(false);
          setPlaybackPositionSeconds(0);
          setPlaybackDurationSeconds(0);
          pendingSeekSecondsRef.current = restorePosition > 0 ? restorePosition : null;
          setPlaybackPositionSeconds(restorePosition);
          setPlaybackDurationSeconds(progress.durationSeconds ?? 0);
          cachePlaybackSession(session);
          pendingResumeRecoveryTrackIdRef.current = null;
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
                  : restorePosition,
                durationSeconds: Number.isFinite(audio.duration)
                  ? audio.duration
                  : (progress.durationSeconds ?? null),
                isPlaying: true,
              });
            }
          } catch (playError) {
            browserLogger.error("Audio playback failed to start.", playError);
            setPlaybackError("Presiona reproducir para continuar.");
          }
        } catch (error) {
          browserLogger.error("Failed to start playback.", error);
          if (playbackRequestIdRef.current === requestId) {
            if (!isSwitchAttempt) {
              setPlaybackError("No se pudo iniciar la reproducción.");
            }
            toast("No se pudo iniciar la reproducción de esta pista.");
          }
        } finally {
          if (playbackRequestIdRef.current === requestId) {
            setIsPlaybackLoading(false);
          }
        }
      },
      [cachePlaybackSession, currentTrack, saveCurrentProgress, setCurrentTrack, setPlaybackQueue, toast, volume]
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
      async (trackId: string, saveCurrent = true, resumeProgress = false) => {
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
          saveCurrent,
          resumeProgress
        );
      },
      [startPlayback]
    );

    const restartCurrentTrack = useCallback(
      async (playAfterRestart: boolean) => {
        const audio = audioRef.current;
        if (!audio) {
          return;
        }

        audio.currentTime = 0;
        pendingSeekSecondsRef.current = null;
        setPlaybackPositionSeconds(0);

        if (playAfterRestart) {
          try {
            await audio.play();
            setIsPlaying(true);
          } catch (error) {
            browserLogger.error("Audio playback failed after restart.", error);
            setPlaybackError("No se pudo continuar la reproducción.");
            toast("No se pudo continuar la reproducción.");
          }
        } else {
          setIsPlaying(false);
        }

        await saveCurrentProgress(playAfterRestart);
      },
      [saveCurrentProgress, toast]
    );

    const finishPlayback = useCallback(async () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = audio.duration;
          setPlaybackPositionSeconds(audio.duration);
        }
      }

      setIsPlaying(false);
      await saveCurrentProgress(false);
    }, [saveCurrentProgress]);

    const handleNextTrack = useCallback(() => {
      const queue = playbackQueueRef.current;
      const nextTrackId = getNextQueueTrackId(queue, repeatEnabled);

      if (!nextTrackId) {
        void finishPlayback();
        return;
      }

      if (nextTrackId === queue.currentTrackId) {
        void restartCurrentTrack(true);
        return;
      }

      void playQueueTrackById(nextTrackId);
    }, [finishPlayback, playQueueTrackById, repeatEnabled, restartCurrentTrack]);

    const handlePreviousTrack = useCallback(() => {
      const queue = playbackQueueRef.current;
      const audio = audioRef.current;

      if (queue.sourceType !== "album") {
        void restartCurrentTrack(isPlaying);
        return;
      }

      if (audio && audio.currentTime > 5) {
        void restartCurrentTrack(isPlaying);
        return;
      }

      const previousTrackId = getPreviousQueueTrackId(queue);
      if (!previousTrackId) {
        void restartCurrentTrack(isPlaying);
        return;
      }

      void playQueueTrackById(previousTrackId);
    }, [isPlaying, playQueueTrackById, restartCurrentTrack]);

    const resumePlayback = useCallback(async (forceRefresh = false) => {
      const audio = audioRef.current;
      const track = currentTrackRef.current;
      const trackId = getTrackIdentifier(track);

      if (!audio || !trackId) {
        return;
      }

      const resumePosition = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setPlaybackError("");
      setIsPlaybackLoading(true);

      try {
        if (!forceRefresh && canReusePlaybackSession(trackId)) {
          pendingResumeRecoveryTrackIdRef.current = trackId;
          audio.volume = volume / 100;
          lastProgressSyncAtRef.current = Date.now();
          await audio.play();
          setIsPlaying(true);
          await playbackService.updatePlaybackProgress(trackId, {
            positionSeconds: resumePosition,
            durationSeconds: Number.isFinite(audio.duration)
              ? audio.duration
              : (playbackDurationSeconds || null),
            isPlaying: true,
          });
          pendingResumeRecoveryTrackIdRef.current = null;
          return;
        }

        const session = await playbackService.createStreamSession(trackId);

        if (getTrackIdentifier(currentTrackRef.current) !== trackId) {
          return;
        }

        pendingSeekSecondsRef.current = resumePosition > 0 ? resumePosition : null;
        setPlaybackPositionSeconds(resumePosition);
        cachePlaybackSession(session);
        pendingResumeRecoveryTrackIdRef.current = null;
        audio.src = session.streamUrl;
        audio.volume = volume / 100;
        audio.load();
        lastProgressSyncAtRef.current = Date.now();

        await audio.play();
        setIsPlaying(true);
        await playbackService.updatePlaybackProgress(trackId, {
          positionSeconds: resumePosition,
          durationSeconds: Number.isFinite(audio.duration)
            ? audio.duration
            : (playbackDurationSeconds || null),
          isPlaying: true,
        });
      } catch (error) {
        if (!forceRefresh && getTrackIdentifier(currentTrackRef.current) === trackId) {
          browserLogger.warn("Cached playback resume failed. Refreshing stream session.", error);
          pendingResumeRecoveryTrackIdRef.current = null;
          await resumePlayback(true);
          return;
        }

        browserLogger.error("Audio playback failed to resume with a refreshed stream session.", error);
        setIsPlaying(false);
        pendingResumeRecoveryTrackIdRef.current = null;
        setPlaybackError("No se pudo continuar la reproducción.");
        toast("No se pudo continuar la reproducción.");
      } finally {
        if (getTrackIdentifier(currentTrackRef.current) === trackId) {
          setIsPlaybackLoading(false);
        }
      }
    }, [cachePlaybackSession, canReusePlaybackSession, playbackDurationSeconds, toast, volume]);

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

    const handleToggleRepeat = useCallback(() => {
      setRepeatEnabled((enabled) => !enabled);
    }, []);

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
        await resumePlayback();
        return;
      }

      audio.pause();
    }, [resumePlayback, startPlayback]);

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

      const queue = playbackQueueRef.current;
      const nextTrackId = getNextQueueTrackId(queue, repeatEnabled);

      if (!nextTrackId) {
        return;
      }

      if (nextTrackId === queue.currentTrackId) {
        await restartCurrentTrack(true);
        return;
      }

      await playQueueTrackById(nextTrackId, false, false);
    }, [playQueueTrackById, repeatEnabled, restartCurrentTrack, saveCurrentProgress]);

    const handleAudioError = useCallback(() => {
      const trackId = getTrackIdentifier(currentTrackRef.current);
      if (!trackId) {
        return;
      }

      if (pendingResumeRecoveryTrackIdRef.current === trackId) {
        pendingResumeRecoveryTrackIdRef.current = null;
        void resumePlayback(true);
        return;
      }

      setIsPlaying(false);
      setIsPlaybackLoading(false);
      setPlaybackError("No se pudo reproducir el audio.");
      toast("No se pudo reproducir el audio.");
    }, [resumePlayback, toast]);

    const reset = useCallback(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      playbackSessionRef.current = null;
      pendingResumeRecoveryTrackIdRef.current = null;
      setIsPlaying(false);
      setIsPlaybackLoading(false);
      setPlaybackPositionSeconds(0);
      setPlaybackDurationSeconds(0);
      setPlaybackError("");
      setRepeatEnabled(false);
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
          browserLogger.error("Failed to load latest playback into player.", error);
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
      repeatEnabled,
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
          onToggleRepeat={handleToggleRepeat}
          isLiked={currentTrackLikeState.isLiked}
          isLikeLoading={currentTrackLikeState.isLoading}
          onToggleLike={onToggleCurrentTrackLike}
          toast={toast}
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
        onToggleRepeat={handleToggleRepeat}
        isLiked={currentTrackLikeState.isLiked}
        isLikeLoading={currentTrackLikeState.isLoading}
        onToggleLike={onToggleCurrentTrackLike}
        toast={toast}
      />
        <audio
          ref={audioRef}
          crossOrigin="use-credentials"
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

function getRouteErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudo cargar la información.";
}

function getDefaultRoute(user: CurrentUser): string {
  if (user.role === "admin") {
    return routes.adminOverview;
  }

  if (user.role === "artist") {
    return routes.artistDashboard;
  }

  return routes.home;
}

function readSidebarPreference(storageKey: string): boolean {
  try {
    return globalThis.localStorage?.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

function writeSidebarPreference(storageKey: string, collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(storageKey, String(collapsed));
  } catch {
    // Ignore storage failures; the in-memory preference still works for this session.
  }
}

type SinglePlaybackRouteProps = Readonly<{
  currentTrack: AppTrack | null;
  onPlayTrack: (track: AppTrack) => void;
}>;

type ArtistProfileRouteProps = SinglePlaybackRouteProps & Readonly<{
  currentUser: CurrentUser;
  toast: (msg: string) => void;
}>;

type AlbumPlaybackRouteProps = Readonly<{
  currentTrack: AppTrack | null;
  onPlayTrack: (track: AppTrack, tracks: AppTrack[], albumId: string) => void;
  toast: (msg: string) => void;
}>;

function AlbumDetailRoute({ currentTrack, onPlayTrack, toast }: AlbumPlaybackRouteProps) {
  const { albumId } = useParams();

  if (!albumId) {
    return (
      <NotAvailableState
        title="Álbum no seleccionado"
        message="No encontramos el álbum que intentas abrir."
      />
    );
  }

  return (
    <AlbumDetailPage
      albumId={albumId}
      currentTrack={currentTrack}
      onPlayTrack={onPlayTrack}
      toast={toast}
    />
  );
}

function ArtistProfileRoute({ currentTrack, currentUser, onPlayTrack, toast }: ArtistProfileRouteProps) {
  const { artistId } = useParams();

  if (!artistId) {
    return (
      <NotAvailableState
        title="Artista no seleccionado"
        message="No encontramos el artista que intentas abrir."
      />
    );
  }

  return (
    <ArtistProfilePage
      artistId={artistId}
      currentUser={currentUser}
      currentTrack={currentTrack}
      onPlayTrack={onPlayTrack}
      toast={toast}
    />
  );
}

type PlaylistDetailRouteProps = Readonly<{
  currentTrack: AppTrack | null;
  onPlayTrack: (track: AppTrack, tracks: AppTrack[], playlistId: string) => void;
  toast: (msg: string) => void;
}>;

function PlaylistDetailRoute({ currentTrack, onPlayTrack, toast }: PlaylistDetailRouteProps) {
  const { playlistId } = useParams();

  if (!playlistId) {
    return (
      <NotAvailableState
        title="Playlist no seleccionada"
        message="No encontramos la playlist que intentas abrir."
      />
    );
  }

  return (
    <PlaylistDetailPage
      playlistId={playlistId}
      currentTrack={currentTrack}
      onPlayTrack={onPlayTrack}
      toast={toast}
    />
  );
}

function ArtistDiscographyRoute({ currentTrack, currentUser, onPlayTrack, toast }: ArtistProfileRouteProps) {
  const { artistId } = useParams();

  if (!artistId) {
    return (
      <NotAvailableState
        title="Discografía no seleccionada"
        message="No encontramos el artista que intentas abrir."
      />
    );
  }

  return (
    <ArtistDiscographyPage
      artistId={artistId}
      currentUser={currentUser}
      currentTrack={currentTrack}
      onPlayTrack={onPlayTrack}
      toast={toast}
    />
  );
}

type LiveRoomRouteState = {
  room?: LiveRoom;
} | null;

function ListenerLiveRoomRoute() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LiveRoomRouteState;
  const room = state?.room;

  if (!roomId) {
    return (
      <NotAvailableState
        title="Transmisión no seleccionada"
        message="No encontramos la transmisión que intentas abrir."
      />
    );
  }

  return (
    <ListenerLiveRoom
      roomId={roomId}
      concertTitle={room?.title}
      artistName={room?.artistName || room?.artistId}
      onLeave={() => navigate(routes.lives)}
    />
  );
}

type ArtistUploadRouteProps = Readonly<{
  toast: (msg: string) => void;
  user: CurrentUser;
}>;

function ArtistUploadRoute({ toast, user }: ArtistUploadRouteProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialAlbumId = searchParams.get("albumId");

  return (
    <UploadSinglePage
      toast={toast}
      user={user}
      initialAlbumId={initialAlbumId}
      onUploadAlbumConsumed={() => navigate(routes.artistUpload, { replace: true })}
    />
  );
}

type ArtistEditTrackRouteProps = Readonly<{
  toast: (msg: string) => void;
  user: CurrentUser;
}>;

function ArtistEditTrackRoute({ toast, user }: ArtistEditTrackRouteProps) {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const [track, setTrack] = useState<AppTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!trackId) {
      return undefined;
    }

    let mounted = true;
    setIsLoading(true);
    setError("");
    setTrack(null);

    catalogService
      .getTrack(trackId)
      .then((loadedTrack) => {
        if (mounted) {
          setTrack(loadedTrack);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError(getRouteErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [trackId]);

  if (!trackId) {
    return (
      <NotAvailableState
        title="Pista no seleccionada"
        message="No encontramos la pista que intentas editar."
      />
    );
  }

  if (isLoading) {
    return <div className="page-inner">Cargando pista...</div>;
  }

  if (error) {
    return <NotAvailableState title="No se pudo cargar la pista" message={error} />;
  }

  if (!track) {
    return <div className="page-inner">Preparando editor...</div>;
  }

  return (
    <EditTrackPage
      track={track}
      user={user}
      onCancel={() => navigate(routes.artistTracks)}
      onDone={() => navigate(routes.artistTracks)}
      toast={toast}
    />
  );
}

export default function StreamButed() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileViewport();
  const {
    user,
    isLoadingSession,
    login,
    startRegistration,
    verifyRegistration,
    resendRegistrationCode,
    cancelRegistration,
    startPasswordReset,
    resendPasswordResetCode,
    verifyPasswordResetCode,
    completePasswordReset,
    completeGooglePasswordSetup,
    logout,
  } = useAuth();

  const [currentTrack, setCurrentTrack] = useState<AppTrack | null>(null);
  const [currentTrackLikeState, setCurrentTrackLikeState] = useState<CurrentTrackLikeState>({
    trackId: null,
    isLiked: false,
    isLoading: false,
  });
  const [playbackQueue, setPlaybackQueue] = useState<PlaybackQueueState>(EMPTY_QUEUE);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [oauthStatus, setOauthStatus] = useState("");
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(() =>
    readSidebarPreference("streambuted:sidebar:admin")
  );
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(() =>
    readSidebarPreference("streambuted:sidebar:main")
  );

  const playbackControllerRef = useRef<PlaybackControllerHandle | null>(null);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);
  const openMobileMenu = useCallback(() => setIsMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const toggleAdminSidebar = useCallback(() => {
    setIsAdminSidebarCollapsed((current) => {
      const next = !current;
      writeSidebarPreference("streambuted:sidebar:admin", next);
      return next;
    });
  }, []);
  const toggleMainSidebar = useCallback(() => {
    setIsMainSidebarCollapsed((current) => {
      const next = !current;
      writeSidebarPreference("streambuted:sidebar:main", next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isMobile && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile, isMobileMenuOpen]);

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

  useEffect(() => {
    if (!user || user.role === "admin") {
      setCurrentTrackLikeState({ trackId: null, isLiked: false, isLoading: false });
      return undefined;
    }

    const trackId = getTrackIdentifier(currentTrack);
    if (!trackId) {
      setCurrentTrackLikeState({ trackId: null, isLiked: false, isLoading: false });
      return undefined;
    }

    let mounted = true;

    const loadLikeStatus = async (silent = false) => {
      if (!silent) {
        setCurrentTrackLikeState({ trackId, isLiked: false, isLoading: true });
      }

      try {
        const status = await libraryService.getTrackLikeStatus(trackId);
        if (mounted) {
          setCurrentTrackLikeState({
            trackId,
            isLiked: status.isLiked,
            isLoading: false,
          });
        }
      } catch (error) {
        browserLogger.warn("Failed to load like status for current track.", error);
        if (mounted) {
          setCurrentTrackLikeState((state) => ({
            trackId,
            isLiked: silent ? state.isLiked : false,
            isLoading: false,
          }));
        }
      }
    };

    void loadLikeStatus();
    const unsubscribe = subscribeToLibraryEvents((event) => {
      if (event.type === "liked-songs-changed") {
        void loadLikeStatus(true);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentTrack, user]);

  const toggleCurrentTrackLike = useCallback(async () => {
    const trackId = getTrackIdentifier(currentTrack);
    if (!trackId || currentTrackLikeState.isLoading) {
      return;
    }

    setCurrentTrackLikeState((state) => ({
      ...state,
      trackId,
      isLoading: true,
    }));

    try {
      const status = currentTrackLikeState.isLiked
        ? await libraryService.unlikeTrack(trackId)
        : await libraryService.likeTrack(trackId);
      setCurrentTrackLikeState({
        trackId,
        isLiked: status.isLiked,
        isLoading: false,
      });
      emitLikedSongsChanged();
      toast(status.isLiked ? "Agregada a tus me gusta" : "Quitada de tus me gusta");
    } catch (error) {
      browserLogger.error("Failed to toggle track like.", error);
      setCurrentTrackLikeState((state) => ({
        ...state,
        trackId,
        isLoading: false,
      }));
      toast(toUserFacingMessage(error instanceof Error ? error.message : "No se pudo actualizar me gusta."));
    }
  }, [currentTrack, currentTrackLikeState.isLiked, currentTrackLikeState.isLoading, toast]);

  const resetNavigation = useCallback((nextUser: CurrentUser | null) => {
    playbackControllerRef.current?.reset();
    setCurrentTrack(null);
    setPlaybackQueue(EMPTY_QUEUE);
    const pendingDesktopAuth = nextUser ? readPendingDesktopAuth() : null;
    let nextRoute = routes.login;
    if (pendingDesktopAuth) {
      nextRoute = `${routes.desktopAuthStart}?state=${encodeURIComponent(pendingDesktopAuth.state)}`;
    } else if (nextUser) {
      nextRoute = getDefaultRoute(nextUser);
    }
    navigate(nextRoute, { replace: true });
  }, [navigate]);

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

  const handleGoogleAuth = async (mode: "login" | "register") => {
    const desktopAuth = globalThis.window.streambuted?.isElectron ? globalThis.window.streambuted.auth : undefined;
    if (desktopAuth) {
      await desktopAuth.startGoogleOAuth();
      return;
    }

    globalThis.window.location.assign(authService.getGoogleAuthUrl(mode));
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

  const handleStartPasswordReset = async (request: { email: string }) => {
    return startPasswordReset(request);
  };

  const handleResendPasswordResetCode = async (request: { attemptId: string; email: string }) => {
    return resendPasswordResetCode(request);
  };

  const handleVerifyPasswordResetCode = async (request: {
    attemptId: string;
    email: string;
    code: string;
  }) => {
    await verifyPasswordResetCode(request);
  };

  const handleCompletePasswordReset = async (request: {
    attemptId: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    await completePasswordReset(request);
  };

  useEffect(() => {
    if (location.pathname === routes.desktopAuthStart) {
      const params = new URLSearchParams(location.search);
      const desktopState = params.get("state")?.trim() ?? "";
      if (DESKTOP_AUTH_STATE_PATTERN.test(desktopState)) {
        savePendingDesktopAuth(desktopState);
      }
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!user || user.passwordSetupRequired || location.pathname === routes.desktopAuthStart) {
      return;
    }

    const pendingDesktopAuth = readPendingDesktopAuth();
    if (pendingDesktopAuth) {
      navigate(`${routes.desktopAuthStart}?state=${encodeURIComponent(pendingDesktopAuth.state)}`, {
        replace: true,
      });
    }
  }, [location.pathname, navigate, user]);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.window.location.search);
    const oauthStatus = params.get("oauth");
    if (!oauthStatus) return;

    setOauthStatus(oauthStatus);
    if (oauthStatus === "google-error") {
      setOauthError(toUserFacingMessage(params.get("message") || "No se pudo completar el acceso con Google."));
    } else if (oauthStatus === "google-password-setup") {
      setOauthError("Completa tu contraseña para terminar el registro con Google.");
    } else {
      setOauthError("");
    }

    params.delete("oauth");
    params.delete("message");
    const nextSearch = params.toString();
    const nextUrl = [
      globalThis.window.location.pathname,
      nextSearch ? `?${nextSearch}` : "",
      globalThis.window.location.hash,
    ].join("");
    globalThis.window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    const handleSessionTerminated = (event: Event) => {
      const payload = event instanceof CustomEvent ? event.detail : null;
      if (payload?.code === "ACCOUNT_BANNED" || payload?.error === "AccountBannedException") {
        setShowSuspendedDialog(true);
      }
    };

    globalThis.addEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
    return () => {
      globalThis.removeEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
    };
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await playbackControllerRef.current?.saveCurrentProgress(false);
      await logout();
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
          <div className="auth-title">Cargando sesión</div>
          <div className="auth-sub">Preparando tu experiencia...</div>
        </div>
      </div>
    );
  }

  if (location.pathname === routes.desktopAuthStart) {
    return <DesktopAuthStartPage />;
  }

  if (!user) {
    const loginPage = (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => navigate(routes.register)}
        onStartPasswordReset={handleStartPasswordReset}
        onResendPasswordResetCode={handleResendPasswordResetCode}
        onVerifyPasswordResetCode={handleVerifyPasswordResetCode}
        onCompletePasswordReset={handleCompletePasswordReset}
        onGoogleLogin={() => handleGoogleAuth("login")}
        externalError={oauthError}
      />
    );

    return (
      <>
        <Routes>
          <Route path={routes.login} element={loginPage} />
          <Route path={routes.authCallback} element={loginPage} />
          <Route path={routes.desktopAuthStart} element={<DesktopAuthStartPage />} />
          <Route
            path={routes.register}
            element={
              <RegisterPage
                onStartRegistration={handleRegister}
                onVerifyRegistration={handleVerifyRegistration}
                onResendCode={resendRegistrationCode}
                onCancelVerification={cancelRegistration}
                onBack={() => navigate(routes.login)}
                externalError={oauthError}
              />
            }
          />
          <Route path="*" element={<Navigate to={routes.login} replace />} />
        </Routes>
        <ConfirmDialog
          open={showSuspendedDialog}
          title="Cuenta suspendida"
          message="Tu cuenta fue suspendida por un administrador del sistema."
          confirmLabel="Aceptar"
          showCancel={false}
          tone="primary"
          onConfirm={() => setShowSuspendedDialog(false)}
          onCancel={() => setShowSuspendedDialog(false)}
        />
      </>
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

  const defaultRoute = getDefaultRoute(user);
  const mainMobileNavItems: readonly MobileNavItem[] = [
    { to: routes.home, end: true, label: "Inicio", icon: <IcHome /> },
    { to: routes.search, label: "Buscar", icon: <IcSearch /> },
    { to: routes.library, label: "Biblioteca", icon: <IcLib /> },
    { to: routes.lives, label: "En vivo", icon: <IcCamera /> },
    { to: routes.settings, label: "Ajustes", icon: <IcSettings /> },
  ];
  const adminMobileNavItems: readonly MobileNavItem[] = [
    { to: routes.adminOverview, end: true, label: "Resumen", icon: <IcOverview /> },
    { to: routes.adminReports, label: "Reportes", icon: <IcReport /> },
    { to: routes.adminModeration, label: "Moderacion", icon: <IcShield /> },
    { to: routes.settings, label: "Ajustes", icon: <IcSettings /> },
  ];
  const requestLogout = () => setShowLogoutConfirmation(true);
  const showArtistMobileMenu = isMobile && user.role === "artist";
  const mobileProfileTarget =
    user.role === "artist" && user.id
      ? routes.artistProfile(user.id)
      : routes.settings;
  const mobileProfileLabel =
    user.role === "artist"
      ? `Abrir perfil publico de ${user.username}`
      : "Abrir ajustes";
  const mobileProfileNode = (
    <Link className="mobile-profile-link" to={mobileProfileTarget} aria-label={mobileProfileLabel}>
      <div className="mobile-profile-avatar">
        {user.profileImageAssetId ? (
          <img
            src={getAssetUrl(user.profileImageAssetId)}
            alt={`Foto de perfil de ${user.username || "usuario"}`}
          />
        ) : (
          user.username[0]?.toUpperCase()
        )}
      </div>
    </Link>
  );
  const logoutDialog = (
    <ConfirmDialog
      open={showLogoutConfirmation}
      title="Cerrar sesión"
      message="Guardaremos tu progreso actual y volverás a la pantalla de inicio de sesión."
      confirmLabel="Cerrar sesión"
      tone="primary"
      isLoading={isLoggingOut}
      onConfirm={handleLogout}
      onCancel={() => setShowLogoutConfirmation(false)}
    />
  );
  const toastNode = toastMsg ? <Toast msg={toastMsg} onDone={() => setToastMsg(null)} /> : null;
  const suspendedDialog = (
    <ConfirmDialog
      open={showSuspendedDialog}
      title="Cuenta suspendida"
      message="Tu cuenta fue suspendida por un administrador del sistema."
      confirmLabel="Aceptar"
      showCancel={false}
      tone="primary"
      onConfirm={() => setShowSuspendedDialog(false)}
      onCancel={() => setShowSuspendedDialog(false)}
    />
  );

  const adminRoutes = (
    <Routes>
      <Route
        path={routes.adminOverview}
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <AdminOverviewPage />
          </RoleRoute>
        }
      />
      <Route
        path={routes.adminUsers}
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <Navigate to={routes.adminModeration} replace />
          </RoleRoute>
        }
      />
      <Route
        path={routes.adminContent}
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <Navigate to={routes.adminModeration} replace />
          </RoleRoute>
        }
      />
      <Route
        path={routes.adminReports}
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <AdminAnalyticsPage />
          </RoleRoute>
        }
      />
      <Route
        path={routes.adminModeration}
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <AdminModerationPage toast={toast} />
          </RoleRoute>
        }
      />
      <Route
        path={routes.settings}
        element={<SettingsPage user={user} toast={toast} onRequestLogout={requestLogout} />}
      />
      <Route path={routes.login} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.register} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.authCallback} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.desktopAuthStart} element={<DesktopAuthStartPage />} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );

  const listenerArtistRoutes = (
    <Routes>
      <Route path={routes.home} element={<HomePage />} />
      <Route
        path={routes.search}
        element={<SearchPage onPlayTrack={playSingleTrack} currentTrack={currentTrack} toast={toast} />}
      />
      <Route
        path={routes.library}
        element={
          <LibraryPage
            currentTrack={currentTrack}
            onPlayCollectionTrack={playAlbumTrack}
            toast={toast}
          />
        }
      />
      <Route
        path={routePatterns.libraryPlaylist}
        element={
          <PlaylistDetailRoute
            currentTrack={currentTrack}
            onPlayTrack={playAlbumTrack}
            toast={toast}
          />
        }
      />
      <Route
        path={routePatterns.album}
        element={<AlbumDetailRoute onPlayTrack={playAlbumTrack} currentTrack={currentTrack} toast={toast} />}
      />
      <Route
        path={routePatterns.artistProfile}
        element={
          <ArtistProfileRoute
            currentUser={user}
            onPlayTrack={playSingleTrack}
            currentTrack={currentTrack}
            toast={toast}
          />
        }
      />
      <Route
        path={routePatterns.artistDiscography}
        element={
          <ArtistDiscographyRoute
            currentUser={user}
            onPlayTrack={playSingleTrack}
            currentTrack={currentTrack}
            toast={toast}
          />
        }
      />
      <Route
        path={routes.lives}
        element={
          <LiveConcertsPage
            userRole={user.role}
            onJoinRoom={(room) => navigate(routes.liveRoom(room.id), { state: { room } })}
            onStartBroadcast={() => navigate(routes.artistLive)}
          />
        }
      />
      <Route path={routePatterns.liveRoom} element={<ListenerLiveRoomRoute />} />
      <Route
        path={routes.artistLive}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <ArtistLiveRoom />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistDashboard}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <ArtistDashboardPage
              user={user}
              onPlayTrack={playSingleTrack}
              currentTrack={currentTrack}
            />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistTracks}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <MyTracksPage
              currentTrack={currentTrack}
              onPlayTrack={playSingleTrack}
              toast={toast}
              user={user}
            />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistAlbums}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <MyAlbumsPage
              currentTrack={currentTrack}
              onPlayTrack={playAlbumTrack}
              toast={toast}
              user={user}
            />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistUpload}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <ArtistUploadRoute toast={toast} user={user} />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistAlbumNew}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <CreateAlbumPage toast={toast} />
          </RoleRoute>
        }
      />
      <Route
        path={routePatterns.artistTrackEdit}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <ArtistEditTrackRoute toast={toast} user={user} />
          </RoleRoute>
        }
      />
      <Route
        path={routes.artistAnalytics}
        element={
          <RoleRoute allowedRoles={["artist"]}>
            <ArtistAnalyticsPage user={user} />
          </RoleRoute>
        }
      />
      <Route
        path={routes.settings}
        element={<SettingsPage user={user} toast={toast} onRequestLogout={requestLogout} />}
      />
      <Route path="/admin/*" element={<Navigate to={routes.home} replace />} />
      <Route path={routes.login} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.register} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.authCallback} element={<Navigate to={defaultRoute} replace />} />
      <Route path={routes.desktopAuthStart} element={<DesktopAuthStartPage />} />
      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );

  if (user.role === "admin") {
    return (
      <div className="app-shell">
        <ResponsiveAppShell
          brandSubtitle=""
          isMobile={isMobile}
          isSidebarCollapsed={isAdminSidebarCollapsed}
          mobileMenuOpen={isMobileMenuOpen}
          mobileProfile={mobileProfileNode}
          mobileSidebar={null}
          onCloseMobileMenu={closeMobileMenu}
          onOpenMobileMenu={openMobileMenu}
          showMobileMenuButton={false}
          sidebar={
            <AdminSidebar
              collapsed={isAdminSidebarCollapsed}
              onToggle={toggleAdminSidebar}
              user={user}
            />
          }
        >
          {adminRoutes}
        </ResponsiveAppShell>
        {isMobile ? <MobileTabBar items={adminMobileNavItems} /> : null}
        {logoutDialog}
        {suspendedDialog}
        {toastNode}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ResponsiveAppShell
        brandSubtitle=""
        isMobile={isMobile}
        isSidebarCollapsed={isMainSidebarCollapsed}
        mobileMenuOpen={isMobileMenuOpen}
        mobileProfile={mobileProfileNode}
        mobileSidebar={showArtistMobileMenu ? (
          <MainSidebar
            collapsed={false}
            onToggle={closeMobileMenu}
            showCollapseButton={false}
            showFooter={false}
            showHeader={false}
            showDiscoverSection={false}
            showManageSection
            user={user}
          />
        ) : null}
        onCloseMobileMenu={closeMobileMenu}
        onOpenMobileMenu={openMobileMenu}
        showMobileMenuButton={showArtistMobileMenu}
        sidebar={
          <MainSidebar
            collapsed={isMainSidebarCollapsed}
            onToggle={toggleMainSidebar}
            user={user}
          />
        }
      >
        {listenerArtistRoutes}
      </ResponsiveAppShell>
      <PlaybackController
        ref={playbackControllerRef}
        user={user}
        currentTrack={currentTrack}
        currentTrackLikeState={currentTrackLikeState}
        playbackQueue={playbackQueue}
        onToggleCurrentTrackLike={toggleCurrentTrackLike}
        setCurrentTrack={setCurrentTrack}
        setPlaybackQueue={setPlaybackQueue}
        toast={toast}
      />
      {isMobile ? <MobileTabBar items={mainMobileNavItems} /> : null}
      {logoutDialog}
      {suspendedDialog}
      {toastNode}
    </div>
  );
}
