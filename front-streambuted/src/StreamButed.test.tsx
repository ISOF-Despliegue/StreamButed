import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import StreamButed from "./StreamButed";
import { SESSION_TERMINATED_EVENT } from "./services/apiClient";

const mockedUseAuth = jest.fn();

jest.mock("./hooks/useAuth", () => ({
  useAuth: () => mockedUseAuth(),
}));

jest.mock("./components/ui/Toast", () => ({
  Toast: () => null,
}));

jest.mock("./components/layout/BottomPlayer", () => ({
  BottomPlayer: () => null,
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

describe("StreamButed suspension dialog", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue(baseAuthValue);
  });

  it("shows a popup when a suspended-account forced logout event is received", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <StreamButed />
      </MemoryRouter>
    );

    window.dispatchEvent(
      new CustomEvent(SESSION_TERMINATED_EVENT, {
        detail: {
          code: "ACCOUNT_BANNED",
        },
      })
    );

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
});
