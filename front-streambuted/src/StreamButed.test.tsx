import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StreamButed from "./StreamButed";
import { SESSION_TERMINATED_EVENT } from "./services/apiClient";
import { playbackService } from "./services/playbackService";
import { catalogService } from "./services/catalogService";

const mockedUseAuth = jest.fn();
const mockedBottomPlayer = jest.fn();

jest.mock("./hooks/useAuth", () => ({
  useAuth: () => mockedUseAuth(),
}));

jest.mock("./components/ui/Toast", () => ({
  Toast: () => null,
}));

jest.mock("./components/layout/BottomPlayer", () => ({
  BottomPlayer: (props: { onTogglePlay: () => Promise<void> | void }) => {
    mockedBottomPlayer(props);
    return <button onClick={() => void props.onTogglePlay()}>Toggle playback</button>;
  },
}));

jest.mock("./components/layout/ExpandedPlayer", () => ({
  ExpandedPlayer: () => null,
}));

jest.mock("./components/layout/Sidebars", () => ({
  MainSidebar: () => <div>Sidebar</div>,
  AdminSidebar: () => <div>Admin Sidebar</div>,
}));

jest.mock("./pages/AuthPages", () => ({
  LoginPage: () => <div>Login Page</div>,
  RegisterPage: () => <div>Register Page</div>,
  GooglePasswordSetupPage: () => <div>Google Password Setup</div>,
}));

jest.mock("./pages/SettingsPage", () => ({
  SettingsPage: () => <div>Settings</div>,
}));

jest.mock("./pages/listener/ListenerPages", () => ({
  HomePage: () => <div>Home</div>,
  SearchPage: () => <div>Search</div>,
  AlbumDetailPage: () => <div>Album Detail</div>,
  ArtistProfilePage: () => <div>Artist Profile</div>,
  ArtistDiscographyPage: () => <div>Artist Discography</div>,
}));

jest.mock("./pages/listener/LibraryPage", () => ({
  LibraryPage: () => <div>Library</div>,
  PlaylistDetailPage: () => <div>Playlist Detail</div>,
}));

jest.mock("./pages/artist/ArtistPages", () => ({
  ArtistDashboardPage: () => <div>Artist Dashboard</div>,
  MyTracksPage: () => <div>My Tracks</div>,
  MyAlbumsPage: () => <div>My Albums</div>,
  UploadSinglePage: () => <div>Upload Single</div>,
  CreateAlbumPage: () => <div>Create Album</div>,
  EditTrackPage: () => <div>Edit Track</div>,
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
  LiveConcertsPage: () => <div>Live Concerts</div>,
}));

jest.mock("./pages/live/ListenerLiveRoom", () => ({
  ListenerLiveRoom: () => <div>Listener Live Room</div>,
}));

jest.mock("./routes/RoleRoute", () => ({
  RoleRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("./services/playbackService", () => ({
  playbackService: {
    getLatestPlaybackProgress: jest.fn().mockResolvedValue({ trackId: null }),
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
    getTrackLikeStatus: jest.fn().mockResolvedValue({ isLiked: false }),
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

    expect(screen.getByText("Artist Discography")).toBeInTheDocument();
  });

  it("refreshes the stream session when resuming a paused track", async () => {
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
        expiresAt: "2026-05-26T12:05:00.000Z",
      })
      .mockResolvedValueOnce({
        trackId: "track-1",
        streamUrl: "https://example.com/stream?playbackToken=fresh-token",
        expiresAt: "2026-05-26T12:10:00.000Z",
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
});
