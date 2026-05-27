import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StreamButed from "./StreamButed";
import { SESSION_TERMINATED_EVENT } from "./services/apiClient";
import { playbackService } from "./services/playbackService";
import { catalogService } from "./services/catalogService";
import { libraryService } from "./services/libraryService";

const mockedUseAuth = jest.fn();
const mockedBottomPlayer = jest.fn();

jest.mock("./hooks/useAuth", () => ({
  useAuth: () => mockedUseAuth(),
}));

jest.mock("./components/ui/Toast", () => ({
  Toast: () => null,
}));

jest.mock("./components/layout/BottomPlayer", () => ({
  BottomPlayer: (props: {
    onExpand: () => void;
    onTogglePlay: () => Promise<void> | void;
    onSeek: (positionSeconds: number) => void;
    onNext: () => void;
    onPrevious: () => void;
    onToggleShuffle: () => void;
    onToggleRepeat: () => void;
    onToggleLike: () => void;
  }) => {
    mockedBottomPlayer(props);
    return (
      <div>
        <button onClick={() => void props.onTogglePlay()}>Toggle playback</button>
        <button onClick={props.onExpand}>Expand player</button>
        <button onClick={() => props.onSeek(30)}>Seek playback</button>
        <button onClick={props.onNext}>Next track</button>
        <button onClick={props.onPrevious}>Previous track</button>
        <button onClick={props.onToggleShuffle}>Shuffle album</button>
        <button onClick={props.onToggleRepeat}>Repeat track</button>
        <button onClick={props.onToggleLike}>Like current track</button>
      </div>
    );
  },
}));

jest.mock("./components/layout/ExpandedPlayer", () => ({
  ExpandedPlayer: ({ onClose }: { onClose: () => void }) => (
    <div>
      Expanded Player
      <button onClick={onClose}>Close expanded player</button>
    </div>
  ),
}));

jest.mock("./components/layout/Sidebars", () => ({
  MainSidebar: () => <div>Sidebar</div>,
  AdminSidebar: () => <div>Admin Sidebar</div>,
}));

jest.mock("./pages/AuthPages", () => ({
  LoginPage: ({
    onLogin,
    onRegister,
    onGoogleLogin,
    externalError,
  }: {
    onLogin: (credentials: { email: string; password: string }) => Promise<void>;
    onRegister: () => void;
    onGoogleLogin: () => void;
    externalError?: string;
  }) => (
    <div>
      Login Page
      <span>{externalError}</span>
      <button onClick={() => void onLogin({ email: "ada@example.com", password: "Password1!" })}>
        Submit login
      </button>
      <button onClick={onRegister}>Open register</button>
      <button onClick={onGoogleLogin}>Google login</button>
    </div>
  ),
  RegisterPage: ({
    onStartRegistration,
    onVerifyRegistration,
    onResendCode,
    onCancelVerification,
    onBack,
    externalError,
  }: {
    onStartRegistration: (request: { email: string; username: string; password: string }) => Promise<unknown>;
    onVerifyRegistration: (request: { attemptId: string; email: string; code: string }) => Promise<void>;
    onResendCode: (request: { attemptId: string; email: string }) => Promise<unknown>;
    onCancelVerification: (request: { attemptId: string; email: string }) => Promise<unknown>;
    onBack: () => void;
    externalError?: string;
  }) => (
    <div>
      Register Page
      <span>{externalError}</span>
      <button
        onClick={() =>
          void onStartRegistration({
            email: "ada@example.com",
            username: "ada",
            password: "Password1!",
          })
        }
      >
        Start registration
      </button>
      <button
        onClick={() =>
          void onVerifyRegistration({
            attemptId: "attempt-1",
            email: "ada@example.com",
            code: "123456",
          })
        }
      >
        Verify registration
      </button>
      <button onClick={() => void onResendCode({ attemptId: "attempt-1", email: "ada@example.com" })}>
        Resend code
      </button>
      <button onClick={() => void onCancelVerification({ attemptId: "attempt-1", email: "ada@example.com" })}>
        Cancel registration
      </button>
      <button onClick={onBack}>Back to login</button>
    </div>
  ),
  GooglePasswordSetupPage: ({
    email,
    onSubmit,
    externalError,
  }: {
    email: string;
    onSubmit: (request: { password: string; confirmPassword: string }) => Promise<void>;
    externalError?: string;
  }) => (
    <div>
      Google Password Setup {email}
      <span>{externalError}</span>
      <button onClick={() => void onSubmit({ password: "Password1!", confirmPassword: "Password1!" })}>
        Complete setup
      </button>
    </div>
  ),
}));

jest.mock("./pages/SettingsPage", () => ({
  SettingsPage: ({ onRequestLogout }: { onRequestLogout: () => void }) => (
    <div>
      Settings
      <button onClick={onRequestLogout}>Request logout</button>
    </div>
  ),
}));

jest.mock("./pages/listener/ListenerPages", () => ({
  HomePage: () => <div>Home</div>,
  SearchPage: ({ onPlayTrack }: { onPlayTrack: (track: Record<string, unknown>) => void }) => (
    <div>
      Search
      <button
        onClick={() =>
          onPlayTrack({
            trackId: "track-1",
            title: "Song 1",
            artistId: "artist-1",
            albumId: null,
            genre: "Pop",
            audioAssetId: "asset-1",
            coverAssetId: "cover-1",
            durationSeconds: 180,
            status: "PUBLICADO",
            createdAt: "2026-05-26T12:00:00.000Z",
            updatedAt: "2026-05-26T12:00:00.000Z",
          })
        }
      >
        Play search result
      </button>
    </div>
  ),
  AlbumDetailPage: ({ albumId }: { albumId: string }) => <div>Album Detail {albumId}</div>,
  ArtistProfilePage: ({ artistId }: { artistId: string }) => <div>Artist Profile {artistId}</div>,
  ArtistDiscographyPage: ({ artistId }: { artistId: string }) => <div>Artist Discography {artistId}</div>,
}));

jest.mock("./pages/listener/LibraryPage", () => ({
  LibraryPage: () => <div>Library</div>,
  PlaylistDetailPage: ({ playlistId }: { playlistId: string }) => <div>Playlist Detail {playlistId}</div>,
}));

jest.mock("./pages/artist/ArtistPages", () => ({
  ArtistDashboardPage: () => <div>Artist Dashboard</div>,
  MyTracksPage: () => <div>My Tracks</div>,
  MyAlbumsPage: ({ onPlayTrack }: { onPlayTrack: (track: Record<string, unknown>, tracks: Array<Record<string, unknown>>, albumId: string) => void }) => {
    const tracks = [
      {
        trackId: "track-1",
        title: "Song 1",
        artistId: "artist-1",
        albumId: "album-1",
        genre: "Pop",
        audioAssetId: "asset-1",
        coverAssetId: "cover-1",
        durationSeconds: 180,
        status: "PUBLICADO",
        createdAt: "2026-05-26T12:00:00.000Z",
        updatedAt: "2026-05-26T12:00:00.000Z",
      },
      {
        trackId: "track-2",
        title: "Song 2",
        artistId: "artist-1",
        albumId: "album-1",
        genre: "Pop",
        audioAssetId: "asset-2",
        coverAssetId: "cover-2",
        durationSeconds: 200,
        status: "PUBLICADO",
        createdAt: "2026-05-26T12:00:00.000Z",
        updatedAt: "2026-05-26T12:00:00.000Z",
      },
    ];

    return (
      <div>
        My Albums
        <button onClick={() => onPlayTrack(tracks[0], tracks, "album-1")}>Play album track</button>
      </div>
    );
  },
  UploadSinglePage: ({
    initialAlbumId,
    onUploadAlbumConsumed,
  }: {
    initialAlbumId: string | null;
    onUploadAlbumConsumed: () => void;
  }) => (
    <div>
      Upload Single {initialAlbumId}
      <button onClick={onUploadAlbumConsumed}>Consume upload album</button>
    </div>
  ),
  CreateAlbumPage: () => <div>Create Album</div>,
  EditTrackPage: ({ track }: { track: { title: string } }) => <div>Edit Track {track.title}</div>,
  ArtistAnalyticsPage: () => <div>Artist Analytics</div>,
}));

jest.mock("./pages/admin/AdminPages", () => ({
  AdminAnalyticsPage: () => <div>Admin Analytics</div>,
  AdminOverviewPage: () => <div>Admin Overview</div>,
  AdminModerationPage: () => <div>Admin Moderation</div>,
}));

jest.mock("./pages/live/ArtistLiveRoom", () => ({
  ArtistLiveRoom: () => <div>Artist Live Room</div>,
}));

jest.mock("./pages/live/LiveConcertsPage", () => ({
  LiveConcertsPage: ({
    onJoinRoom,
    onStartBroadcast,
  }: {
    onJoinRoom?: (room: { id: string; artistId: string; artistName: string; title: string; status: "LIVE" }) => void;
    onStartBroadcast?: () => void;
  }) => (
    <div>
      Live Concerts
      <button
        onClick={() =>
          onJoinRoom?.({
            id: "room-1",
            artistId: "artist-1",
            artistName: "Ada",
            title: "Acoustic night",
            status: "LIVE",
          })
        }
      >
        Join mocked live
      </button>
      <button onClick={onStartBroadcast}>Start mocked live</button>
    </div>
  ),
}));

jest.mock("./pages/live/ListenerLiveRoom", () => ({
  ListenerLiveRoom: ({
    roomId,
    concertTitle,
    artistName,
    onLeave,
  }: {
    roomId: string;
    concertTitle?: string;
    artistName?: string;
    onLeave?: () => void;
  }) => (
    <div>
      Listener Live Room {roomId} {concertTitle} {artistName}
      <button onClick={onLeave}>Leave mocked live</button>
    </div>
  ),
}));

jest.mock("./routes/RoleRoute", () => ({
  RoleRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("./services/playbackService", () => ({
  playbackService: {
    getLatestPlaybackProgress: jest.fn().mockResolvedValue({
      trackId: null,
      positionSeconds: 0,
      durationSeconds: null,
      updatedAt: null,
    }),
    getPlaybackProgress: jest.fn(),
    updatePlaybackProgress: jest.fn(),
    createStreamSession: jest.fn(),
  },
}));

jest.mock("./services/catalogService", () => ({
  catalogService: {
    getTrack: jest.fn(),
    getArtist: jest.fn(),
  },
}));

jest.mock("./services/libraryService", () => ({
  libraryService: {
    getTrackLikeStatus: jest.fn().mockResolvedValue({ trackId: "track-1", isLiked: false }),
    likeTrack: jest.fn(),
    unlikeTrack: jest.fn(),
  },
}));

jest.mock("./services/authService", () => ({
  authService: {
    getGoogleAuthUrl: jest.fn().mockReturnValue("http://localhost/google"),
  },
}));

const baseAuthValue = {
  user: null,
  isLoadingSession: false,
  login: jest.fn(),
  startRegistration: jest.fn(),
  verifyRegistration: jest.fn(),
  resendRegistrationCode: jest.fn(),
  cancelRegistration: jest.fn(),
  completeGooglePasswordSetup: jest.fn(),
  logout: jest.fn(),
};

const mockedPlaybackService = playbackService as jest.Mocked<typeof playbackService>;
const mockedCatalogService = catalogService as jest.Mocked<typeof catalogService>;
const mockedLibraryService = libraryService as jest.Mocked<typeof libraryService>;

function authenticatedUser(role: "listener" | "artist" | "admin" = "listener") {
  return {
    id: `${role}-1`,
    email: `${role}@example.com`,
    role,
    username: role,
  };
}

function arrangeSuccessfulPlayback() {
  mockedPlaybackService.getLatestPlaybackProgress.mockResolvedValue({
    trackId: null,
    positionSeconds: 0,
    durationSeconds: null,
    updatedAt: null,
  });
  mockedPlaybackService.getPlaybackProgress.mockImplementation(async (requestedTrackId: string) => ({
    trackId: requestedTrackId,
    positionSeconds: 0,
    durationSeconds: 180,
    updatedAt: "2026-05-26T12:00:00.000Z",
  }));
  mockedPlaybackService.createStreamSession.mockImplementation(async (requestedTrackId: string) => ({
    trackId: requestedTrackId,
    streamUrl: `https://example.com/${requestedTrackId}?playbackToken=token-${requestedTrackId}`,
    expiresAt: "2099-05-26T12:05:00.000Z",
  }));
  mockedPlaybackService.updatePlaybackProgress.mockImplementation(async (requestedTrackId: string, payload) => ({
    trackId: requestedTrackId,
    positionSeconds: payload.positionSeconds,
    durationSeconds: payload.durationSeconds ?? 180,
    updatedAt: "2026-05-26T12:00:00.000Z",
  }));
}

describe("StreamButed suspension dialog", () => {
  let pausedState = true;
  let pausedSpy: jest.SpyInstance<boolean, []>;
  let playSpy: jest.SpyInstance<Promise<void>, []>;
  let pauseSpy: jest.SpyInstance<void, []>;
  let loadSpy: jest.SpyInstance<void, []>;

  beforeEach(() => {
    mockedUseAuth.mockReturnValue(baseAuthValue);
    mockedBottomPlayer.mockClear();
    jest.clearAllMocks();
    mockedPlaybackService.getLatestPlaybackProgress.mockResolvedValue({
      trackId: null,
      positionSeconds: 0,
      durationSeconds: null,
      updatedAt: null,
    });
    mockedPlaybackService.getPlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 0,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedPlaybackService.createStreamSession.mockResolvedValue({
      trackId: "track-1",
      streamUrl: "https://example.com/stream?playbackToken=default-token",
      expiresAt: "2099-05-26T12:05:00.000Z",
    });
    mockedPlaybackService.updatePlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 0,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedCatalogService.getArtist.mockResolvedValue({
      artistId: "artist-1",
      displayName: "Artist 1",
      biography: null,
      profileImageAssetId: null,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedCatalogService.getTrack.mockResolvedValue({
      trackId: "track-1",
      title: "Song 1",
      artistId: "artist-1",
      albumId: null,
      genre: "Pop",
      audioAssetId: "asset-1",
      coverAssetId: "cover-1",
      durationSeconds: 180,
      status: "PUBLICADO",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedLibraryService.getTrackLikeStatus.mockResolvedValue({ trackId: "track-1", isLiked: false });
    mockedLibraryService.likeTrack.mockResolvedValue({ trackId: "track-1", isLiked: true });
    mockedLibraryService.unlikeTrack.mockResolvedValue({ trackId: "track-1", isLiked: false });
    pausedState = true;

    pausedSpy = jest.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => pausedState);
    playSpy = jest.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play() {
      pausedState = false;
      return Promise.resolve();
    });
    pauseSpy = jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function pause() {
      pausedState = true;
    });
    loadSpy = jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    pausedSpy.mockRestore();
    playSpy.mockRestore();
    pauseSpy.mockRestore();
    loadSpy.mockRestore();
  });

  it("shows a popup when a suspended-account forced logout event is received", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(SESSION_TERMINATED_EVENT, {
          detail: {
            code: "ACCOUNT_BANNED",
          },
        })
      );
    });

    expect(await screen.findByText("Cuenta suspendida")).toBeInTheDocument();
    expect(
      screen.getByText("Tu cuenta fue suspendida por un administrador del sistema.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() => {
      expect(screen.queryByText("Tu cuenta fue suspendida por un administrador del sistema."))
        .not.toBeInTheDocument();
    });
  });

  it("mounts the dedicated artist discography route for authenticated listeners", () => {
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: {
        id: "listener-1",
        email: "listener@example.com",
        role: "listener",
        username: "Listener",
      },
    });

    render(
      <MemoryRouter initialEntries={["/artists/artist-1/discography"]}>
        <StreamButed />
      </MemoryRouter>
    );

    expect(screen.getByText(/Artist Discography/)).toBeInTheDocument();
  });

  it("reuses the cached stream session when resuming a paused track before expiry", async () => {
    const user = userEvent.setup();

    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: {
        id: "listener-1",
        email: "listener@example.com",
        role: "listener",
        username: "Listener",
      },
    });

    mockedPlaybackService.getLatestPlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 24,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedPlaybackService.getPlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 24,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedPlaybackService.createStreamSession
      .mockResolvedValueOnce({
        trackId: "track-1",
        streamUrl: "https://example.com/stream?playbackToken=cached-token",
        expiresAt: "2099-05-26T12:05:00.000Z",
      });
    mockedPlaybackService.updatePlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 42,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:01:00.000Z",
    });
    mockedCatalogService.getTrack.mockResolvedValue({
      trackId: "track-1",
      title: "Song 1",
      artistId: "artist-1",
      albumId: null,
      genre: "Pop",
      audioAssetId: "asset-1",
      coverAssetId: "cover-1",
      durationSeconds: 180,
      status: "PUBLICADO",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedCatalogService.getArtist.mockResolvedValue({
      artistId: "artist-1",
      displayName: "Artist 1",
      biography: null,
      profileImageAssetId: null,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: "Toggle playback" });

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    await waitFor(() => {
      expect(mockedPlaybackService.createStreamSession).toHaveBeenCalledTimes(1);
    });

    const audio = document.querySelector("audio") as HTMLAudioElement;
    audio.currentTime = 42;

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    expect(pauseSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    await waitFor(() => {
      expect(mockedPlaybackService.updatePlaybackProgress).toHaveBeenLastCalledWith("track-1", {
        positionSeconds: 42,
        durationSeconds: 180,
        isPlaying: true,
      });
    });

    expect(mockedPlaybackService.createStreamSession).toHaveBeenCalledTimes(1);
    expect(audio.src).toContain("cached-token");
  });

  it("refreshes the stream session when resuming with an expired playback token", async () => {
    const user = userEvent.setup();

    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: {
        id: "listener-1",
        email: "listener@example.com",
        role: "listener",
        username: "Listener",
      },
    });

    mockedPlaybackService.getLatestPlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 24,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedPlaybackService.getPlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 24,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedPlaybackService.createStreamSession
      .mockResolvedValueOnce({
        trackId: "track-1",
        streamUrl: "https://example.com/stream?playbackToken=expired-token",
        expiresAt: "2000-05-26T12:05:00.000Z",
      })
      .mockResolvedValueOnce({
        trackId: "track-1",
        streamUrl: "https://example.com/stream?playbackToken=fresh-token",
        expiresAt: "2099-05-26T12:10:00.000Z",
      });
    mockedPlaybackService.updatePlaybackProgress.mockResolvedValue({
      trackId: "track-1",
      positionSeconds: 42,
      durationSeconds: 180,
      updatedAt: "2026-05-26T12:01:00.000Z",
    });
    mockedCatalogService.getTrack.mockResolvedValue({
      trackId: "track-1",
      title: "Song 1",
      artistId: "artist-1",
      albumId: null,
      genre: "Pop",
      audioAssetId: "asset-1",
      coverAssetId: "cover-1",
      durationSeconds: 180,
      status: "PUBLICADO",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });
    mockedCatalogService.getArtist.mockResolvedValue({
      artistId: "artist-1",
      displayName: "Artist 1",
      biography: null,
      profileImageAssetId: null,
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: "Toggle playback" });

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    await waitFor(() => {
      expect(mockedPlaybackService.createStreamSession).toHaveBeenCalledTimes(1);
    });

    const audio = document.querySelector("audio") as HTMLAudioElement;
    audio.currentTime = 42;

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    expect(pauseSpy).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Toggle playback" }));

    await waitFor(() => {
      expect(mockedPlaybackService.createStreamSession).toHaveBeenCalledTimes(2);
    });

    expect(audio.src).toContain("fresh-token");
    expect(mockedPlaybackService.updatePlaybackProgress).toHaveBeenLastCalledWith("track-1", {
      positionSeconds: 42,
      durationSeconds: 180,
      isPlaying: true,
    });
  });

  it("shows the session loading screen while auth is being restored", () => {
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      isLoadingSession: true,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <StreamButed />
      </MemoryRouter>
    );

    expect(screen.getByText(/Cargando/)).toBeInTheDocument();
  });

  it("delegates login submissions to the auth hook", async () => {
    const user = userEvent.setup();
    baseAuthValue.login.mockResolvedValueOnce(authenticatedUser("artist"));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Submit login" }));

    await waitFor(() =>
      expect(baseAuthValue.login).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "Password1!",
      })
    );
  });

  it("starts registration from the register route", async () => {
    const user = userEvent.setup();
    baseAuthValue.startRegistration.mockResolvedValueOnce({ attemptId: "attempt-1" });

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Start registration" }));

    await waitFor(() => expect(baseAuthValue.startRegistration).toHaveBeenCalledTimes(1));
  });

  it("verifies registration codes from the register route", async () => {
    const user = userEvent.setup();
    baseAuthValue.verifyRegistration.mockResolvedValueOnce(authenticatedUser("listener"));

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Verify registration" }));

    await waitFor(() => expect(baseAuthValue.verifyRegistration).toHaveBeenCalledTimes(1));
  });

  it("completes Google password setup for pending users", async () => {
    const user = userEvent.setup();
    baseAuthValue.completeGooglePasswordSetup.mockResolvedValueOnce(authenticatedUser("listener"));
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: {
        ...authenticatedUser("listener"),
        passwordSetupRequired: true,
      },
    });

    render(
      <MemoryRouter initialEntries={["/auth/callback"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Complete setup" }));

    await waitFor(() => expect(baseAuthValue.completeGooglePasswordSetup).toHaveBeenCalledTimes(1));
  });

  it("logs the user out after confirming the settings dialog", async () => {
    const user = userEvent.setup();
    baseAuthValue.logout.mockResolvedValueOnce(undefined);
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("listener"),
    });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Request logout" }));
    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(baseAuthValue.logout).toHaveBeenCalledTimes(1));
  });

  it("navigates listeners into the selected live room", async () => {
    const user = userEvent.setup();
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("listener"),
    });

    render(
      <MemoryRouter initialEntries={["/lives"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Join mocked live" }));

    expect(await screen.findByText(/Listener Live Room room-1 Acoustic night Ada/)).toBeInTheDocument();
  });

  it("navigates artists from the live listing to their broadcast room", async () => {
    const user = userEvent.setup();
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("artist"),
    });

    render(
      <MemoryRouter initialEntries={["/lives"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Start mocked live" }));

    expect(await screen.findByText("Artist Live Room")).toBeInTheDocument();
  });

  it("passes the upload album query parameter to the artist upload page", () => {
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("artist"),
    });

    render(
      <MemoryRouter initialEntries={["/artist/upload?albumId=album-1"]}>
        <StreamButed />
      </MemoryRouter>
    );

    expect(screen.getByText(/Upload Single album-1/)).toBeInTheDocument();
  });

  it("loads the editable track before rendering the artist edit route", async () => {
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("artist"),
    });
    mockedCatalogService.getTrack.mockResolvedValueOnce({
      trackId: "track-1",
      title: "Editable song",
      artistId: "artist-1",
      albumId: null,
      genre: "Pop",
      audioAssetId: "asset-1",
      coverAssetId: "cover-1",
      durationSeconds: 180,
      status: "PUBLICADO",
      createdAt: "2026-05-26T12:00:00.000Z",
      updatedAt: "2026-05-26T12:00:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/artist/tracks/track-1/edit"]}>
        <StreamButed />
      </MemoryRouter>
    );

    expect(await screen.findByText("Edit Track Editable song")).toBeInTheDocument();
  });

  it("starts playback from a listener search result", async () => {
    const user = userEvent.setup();
    arrangeSuccessfulPlayback();
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("listener"),
    });

    render(
      <MemoryRouter initialEntries={["/search"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Play search result" }));

    await waitFor(() => expect(mockedPlaybackService.createStreamSession).toHaveBeenCalledWith("track-1"));
  });

  it("likes the current track from the bottom player", async () => {
    const user = userEvent.setup();
    arrangeSuccessfulPlayback();
    mockedLibraryService.getTrackLikeStatus.mockResolvedValue({ trackId: "track-1", isLiked: false });
    mockedLibraryService.likeTrack.mockResolvedValue({ trackId: "track-1", isLiked: true });
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("listener"),
    });

    render(
      <MemoryRouter initialEntries={["/search"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Play search result" }));
    await waitFor(() => {
      const props = mockedBottomPlayer.mock.calls.at(-1)?.[0] as { isLikeLoading?: boolean };
      if (props?.isLikeLoading) throw new Error("Like status still loading");
    });
    await user.click(screen.getByRole("button", { name: "Like current track" }));

    await waitFor(() => expect(mockedLibraryService.likeTrack).toHaveBeenCalledWith("track-1"));
  });

  it("drives album queue controls from the bottom player", async () => {
    const user = userEvent.setup();
    arrangeSuccessfulPlayback();
    mockedUseAuth.mockReturnValue({
      ...baseAuthValue,
      user: authenticatedUser("artist"),
    });

    render(
      <MemoryRouter initialEntries={["/artist/albums"]}>
        <StreamButed />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Play album track" }));
    await screen.findByRole("button", { name: "Next track" });
    await user.click(screen.getByRole("button", { name: "Shuffle album" }));
    await user.click(screen.getByRole("button", { name: "Repeat track" }));
    await user.click(screen.getByRole("button", { name: "Seek playback" }));
    await user.click(screen.getByRole("button", { name: "Next track" }));
    await user.click(screen.getByRole("button", { name: "Previous track" }));
    await user.click(screen.getByRole("button", { name: "Expand player" }));
    await user.click(screen.getByRole("button", { name: "Close expanded player" }));

    await waitFor(() => expect(mockedPlaybackService.createStreamSession).toHaveBeenCalled());
  });
});
