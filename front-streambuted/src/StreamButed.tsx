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
import { MainSidebar, AdminSidebar } from "./components/layout/Sidebars";
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
import { useAuth } from "./hooks/useAuth";
import { playbackService } from "./services/playbackService";
import { catalogService } from "./services/catalogService";
import { libraryService } from "./services/libraryService";
import { emitLikedSongsChanged } from "./services/libraryEvents";
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
import type { PlaybackProgressRequest } from "./types/playback.types";

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

          const restorePosition = resumeProgress ? (progress.positionSeconds ?? 0) : 0;
          pendingSeekSecondsRef.current = restorePosition > 0 ? restorePosition : null;
          setPlaybackPositionSeconds(restorePosition);
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
            setPlaybackError("No se pudo iniciar la reproducción.");
            toast("No se pudo iniciar la reproducción de esta pista.");
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

    const resumePlayback = useCallback(async () => {
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
        const session = await playbackService.createStreamSession(trackId);

        if (getTrackIdentifier(currentTrackRef.current) !== trackId) {
          return;
        }

        pendingSeekSecondsRef.current = resumePosition > 0 ? resumePosition : null;
        setPlaybackPositionSeconds(resumePosition);
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
        browserLogger.error("Audio playback failed to resume with a refreshed stream session.", error);
        setIsPlaying(false);
        setPlaybackError("No se pudo continuar la reproducciÃ³n.");
        toast("No se pudo continuar la reproducciÃ³n.");
      } finally {
        if (getTrackIdentifier(currentTrackRef.current) === trackId) {
          setIsPlaybackLoading(false);
        }
      }
    }, [playbackDurationSeconds, toast, volume]);

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
}>;

type AlbumPlaybackRouteProps = Readonly<{
  currentTrack: AppTrack | null;
  onPlayTrack: (track: AppTrack, tracks: AppTrack[], albumId: string) => void;
}>;

function AlbumDetailRoute({ currentTrack, onPlayTrack }: AlbumPlaybackRouteProps) {
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
    />
  );
}

function ArtistProfileRoute({ currentTrack, currentUser, onPlayTrack }: ArtistProfileRouteProps) {
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

function ArtistDiscographyRoute({ currentTrack, currentUser, onPlayTrack }: ArtistProfileRouteProps) {
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
  const [isAdminSidebarCollapsed, setIsAdminSidebarCollapsed] = useState(() =>
    readSidebarPreference("streambuted:sidebar:admin")
  );
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(() =>
    readSidebarPreference("streambuted:sidebar:main")
  );

  const playbackControllerRef = useRef<PlaybackControllerHandle | null>(null);

  const toast = useCallback((msg: string) => setToastMsg(msg), []);
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
    setCurrentTrackLikeState({ trackId, isLiked: false, isLoading: true });

    libraryService
      .getTrackLikeStatus(trackId)
      .then((status) => {
        if (mounted) {
          setCurrentTrackLikeState({
            trackId,
            isLiked: status.isLiked,
            isLoading: false,
          });
        }
      })
      .catch((error) => {
        browserLogger.warn("Failed to load like status for current track.", error);
        if (mounted) {
          setCurrentTrackLikeState({ trackId, isLiked: false, isLoading: false });
        }
      });

    return () => {
      mounted = false;
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
    navigate(nextUser ? getDefaultRoute(nextUser) : routes.login, { replace: true });
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
      window.location.pathname,
      nextSearch ? `?${nextSearch}` : "",
      window.location.hash,
    ].join("");
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    const handleSessionTerminated = (event: Event) => {
      const payload = event instanceof CustomEvent ? event.detail : null;
      if (payload?.code === "ACCOUNT_BANNED" || payload?.error === "AccountBannedException") {
        setShowSuspendedDialog(true);
      }
    };

    window.addEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
    return () => {
      window.removeEventListener(SESSION_TERMINATED_EVENT, handleSessionTerminated);
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

  if (!user) {
    const loginPage = (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => navigate(routes.register)}
        onGoogleLogin={() => handleGoogleAuth("register")}
        externalError={oauthError}
      />
    );

    return (
      <>
        <Routes>
          <Route path={routes.login} element={loginPage} />
          <Route path={routes.authCallback} element={loginPage} />
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
  const requestLogout = () => setShowLogoutConfirmation(true);
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

  if (user.role === "admin") {
    return (
      <div className="app-shell">
        <div className={`app-body${isAdminSidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
          <AdminSidebar
            collapsed={isAdminSidebarCollapsed}
            onToggle={toggleAdminSidebar}
            user={user}
          />
          <div className="main-content">
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
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </Routes>
          </div>
        </div>
        {logoutDialog}
        {suspendedDialog}
        {toastNode}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className={`app-body${isMainSidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
        <MainSidebar
          collapsed={isMainSidebarCollapsed}
          onToggle={toggleMainSidebar}
          user={user}
        />
        <div className="main-content">
          <Routes>
            <Route path={routes.home} element={<HomePage />} />
            <Route
              path={routes.search}
              element={<SearchPage onPlayTrack={playSingleTrack} currentTrack={currentTrack} />}
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
              element={<AlbumDetailRoute onPlayTrack={playAlbumTrack} currentTrack={currentTrack} />}
            />
            <Route
              path={routePatterns.artistProfile}
              element={
                <ArtistProfileRoute
                  currentUser={user}
                  onPlayTrack={playSingleTrack}
                  currentTrack={currentTrack}
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
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Routes>
        </div>
      </div>
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
      {logoutDialog}
      {suspendedDialog}
      {toastNode}
    </div>
  );
}

