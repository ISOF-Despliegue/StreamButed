import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { LibraryPage, PlaylistDetailPage } from "./LibraryPage";
import { libraryService } from "../../services/libraryService";
import { mediaService } from "../../services/mediaService";

jest.mock("../../services/libraryService", () => ({
  libraryService: {
    addTrackToPlaylist: jest.fn(),
    createPlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
    getLibrary: jest.fn(),
    getPlaylist: jest.fn(),
    removeTrackFromPlaylist: jest.fn(),
    updatePlaylist: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
  getAssetUrl: jest.fn((assetId: string) => `https://assets/${assetId}`),
  getUploadFileHelperText: jest.fn(() => "Usa un nombre valido."),
  mediaService: {
    uploadPlaylistCover: jest.fn(),
  },
}));

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const librarySummary = {
  likedSongs: {
    playlistId: "liked-1",
    name: "Canciones que te gustan",
    coverAssetId: null,
    isSystem: true,
    systemKey: "LIKED_SONGS",
    trackCount: 2,
    createdAt: "2026-05-24T00:00:00Z",
    updatedAt: "2026-05-24T00:00:00Z",
    tracks: [
      {
        trackId: "track-1",
        artistId: "artist-1",
        artist: "Ada",
        artistName: "Ada",
        albumId: "album-1",
        albumTitle: "Amanecer",
        title: "Quedate",
        genre: "Pop",
        audioAssetId: "audio-1",
        coverAssetId: null,
        durationSeconds: 210,
        status: "PUBLICADO",
        createdAt: "2026-05-24T00:00:00Z",
        updatedAt: "2026-05-24T00:00:00Z",
        addedAt: "2026-05-24T00:00:00Z",
      },
      {
        trackId: "track-2",
        artistId: "artist-2",
        artist: "Beto",
        artistName: "Beto",
        albumId: "album-2",
        albumTitle: "Noches",
        title: "Sol eterno",
        genre: "Rock",
        audioAssetId: "audio-2",
        coverAssetId: null,
        durationSeconds: 180,
        status: "PUBLICADO",
        createdAt: "2026-05-24T00:00:00Z",
        updatedAt: "2026-05-24T00:00:00Z",
        addedAt: "2026-05-24T00:00:00Z",
      },
    ],
  },
  playlists: [],
};

describe("LibraryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryService.getLibrary).mockResolvedValue(librarySummary as never);
    jest.mocked(libraryService.createPlaylist).mockResolvedValue({
      playlistId: "playlist-1",
      name: "Nueva lista",
      coverAssetId: "cover-1",
      isSystem: false,
      systemKey: null,
      trackCount: 0,
      createdAt: "2026-05-24T00:00:00Z",
      updatedAt: "2026-05-24T00:00:00Z",
    } as never);
    jest.mocked(mediaService.uploadPlaylistCover).mockResolvedValue({
      assetId: "cover-1",
    } as never);

    Object.defineProperty(global.URL, "createObjectURL", {
      configurable: true,
      value: jest.fn(() => "blob:playlist-cover"),
      writable: true,
    });
    Object.defineProperty(global.URL, "revokeObjectURL", {
      configurable: true,
      value: jest.fn(),
      writable: true,
    });
  });

  it("keeps the playlist name input focused while typing and uploads a cover with preview", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={toast}
      />
    );

    await screen.findByText("Canciones que te gustan");

    await user.click(screen.getByRole("button", { name: "Crear playlist" }));

    const dialog = screen.getByRole("dialog");
    const nameInput = screen.getByLabelText("Nombre de playlist");

    await user.type(nameInput, "Nueva lista");

    expect(nameInput).toHaveValue("Nueva lista");
    expect(document.activeElement).toBe(nameInput);

    const coverInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(coverInput, new File(["cover"], "playlist-cover.png", { type: "image/png" }));

    expect(within(dialog).getByText("playlist-cover.png")).toBeInTheDocument();
    expect(within(dialog).getByAltText(/playlist/i)).toHaveAttribute("src", "blob:playlist-cover");

    await user.click(within(dialog).getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(mediaService.uploadPlaylistCover).toHaveBeenCalledWith(expect.any(File));
      expect(libraryService.createPlaylist).toHaveBeenCalledWith({
        name: "Nueva lista",
        coverAssetId: "cover-1",
      });
    });
    expect(toast).toHaveBeenCalledWith("Playlist creada");
  });

  it("keeps liked songs out of the library landing view", async () => {
    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Canciones que te gustan");
    expect(screen.queryByText("Quedate")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Buscar en tus me gusta")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver playlist" })).toBeInTheDocument();
  });

  it("filters liked songs inside the playlist detail with the reusable local search behavior", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(librarySummary.likedSongs as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="liked-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Quedate");
    expect(screen.getByText("Sol eterno")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar pista actual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Buscar en tus me gusta"), "que{enter}");

    await waitFor(() => {
      expect(screen.getByText("Quedate")).toBeInTheDocument();
      expect(screen.queryByText("Sol eterno")).not.toBeInTheDocument();
    });
  });
});
