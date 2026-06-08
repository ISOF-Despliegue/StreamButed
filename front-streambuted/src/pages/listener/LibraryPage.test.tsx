import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { LibraryPage, PlaylistDetailPage } from "./LibraryPage";
import {
  emitLikedSongsChanged,
  emitPlaylistCreated,
  emitPlaylistDeleted,
  emitPlaylistUpdated,
} from "../../services/libraryEvents";
import { catalogService } from "../../services/catalogService";
import { libraryService } from "../../services/libraryService";
import { mediaService } from "../../services/mediaService";

jest.mock("../../services/libraryService", () => ({
  libraryService: {
    addTrackToPlaylist: jest.fn(),
    createPlaylist: jest.fn(),
    deletePlaylist: jest.fn(),
    getLibrary: jest.fn(),
    getLikedSongs: jest.fn(),
    getPlaylist: jest.fn(),
    listPlaylists: jest.fn(),
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

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    searchCatalog: jest.fn(),
  },
}));

function renderWithRouter(ui: ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
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

const privatePlaylist = {
  playlistId: "playlist-1",
  name: "Road mix",
  coverAssetId: null,
  isSystem: false,
  systemKey: null,
  trackCount: 2,
  createdAt: "2026-05-24T00:00:00Z",
  updatedAt: "2026-05-24T00:00:00Z",
  tracks: librarySummary.likedSongs.tracks,
};

const currentTrack = {
  trackId: "track-3",
  artistId: "artist-3",
  artist: "Cora",
  artistName: "Cora",
  albumId: "album-3",
  albumTitle: "Aurora",
  title: "Nuevo pulso",
  genre: "Indie",
  audioAssetId: "audio-3",
  coverAssetId: null,
  durationSeconds: 200,
  status: "PUBLICADO",
  createdAt: "2026-05-24T00:00:00Z",
  updatedAt: "2026-05-24T00:00:00Z",
};

describe("LibraryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(libraryService.getLibrary).mockResolvedValue(librarySummary as never);
    jest.mocked(libraryService.getLikedSongs).mockResolvedValue(librarySummary.likedSongs as never);
    jest.mocked(libraryService.listPlaylists).mockResolvedValue(librarySummary.playlists as never);
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
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [],
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

  it("rejects creating a playlist with an exact duplicate name before sending the request", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();
    jest.mocked(libraryService.getLibrary).mockResolvedValue({
      ...librarySummary,
      playlists: [
        {
          playlistId: "playlist-1",
          name: "playlist",
          coverAssetId: null,
          isSystem: false,
          systemKey: null,
          trackCount: 0,
          createdAt: "2026-05-24T00:00:00Z",
          updatedAt: "2026-05-24T00:00:00Z",
        },
      ],
    } as never);

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={toast}
      />
    );

    await screen.findByText("playlist");
    await user.click(screen.getByRole("button", { name: "Crear playlist" }));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre de playlist"), "playlist");
    await user.click(within(dialog).getByRole("button", { name: "Crear" }));

    expect(libraryService.createPlaylist).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Ya existe una playlist con ese nombre.");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens liked songs from the cover/title area without rendering the detail on the landing view", async () => {
    const user = userEvent.setup();

    renderWithRouter(
      <>
        <LocationProbe />
        <LibraryPage
          currentTrack={null}
          onPlayCollectionTrack={jest.fn()}
          toast={jest.fn()}
        />
      </>
    );

    await screen.findByText("Canciones que te gustan");
    expect(screen.queryByText("Quedate")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Buscar en tus me gusta")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir playlist Canciones que te gustan" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/library/playlists/liked-1");
    });
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
    expect(screen.getByText("Genero")).toBeInTheDocument();
    expect(screen.getByText("Pop")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar pista actual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Buscar en tus me gusta"), "que{enter}");

    await waitFor(() => {
      expect(screen.getByText("Quedate")).toBeInTheDocument();
      expect(screen.queryByText("Sol eterno")).not.toBeInTheDocument();
    });
  });

  it("renders only one pair of library action buttons per track row in playlist details", async () => {
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(librarySummary.likedSongs as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="liked-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    const row = (await screen.findByText("Quedate")).closest("tr");

    expect(
      within(row as HTMLElement).getAllByRole("button").filter((button) => (
        /canciones que te gustan|Agregar a playlist/i.test(button.getAttribute("aria-label") ?? "")
      ))
    ).toHaveLength(2);
  });

  it("refreshes liked songs detail when the current likes change elsewhere", async () => {
    const updatedLikedSongs = {
      ...librarySummary.likedSongs,
      trackCount: 3,
      tracks: [
        ...librarySummary.likedSongs.tracks,
        {
          trackId: "track-3",
          artistId: "artist-3",
          artist: "Cora",
          artistName: "Cora",
          albumId: "album-3",
          albumTitle: "Aurora",
          title: "Nuevo pulso",
          genre: "Indie",
          audioAssetId: "audio-3",
          coverAssetId: null,
          durationSeconds: 200,
          status: "PUBLICADO",
          createdAt: "2026-05-24T00:00:00Z",
          updatedAt: "2026-05-24T00:00:00Z",
          addedAt: "2026-05-24T00:00:00Z",
        },
      ],
    };
    jest.mocked(libraryService.getPlaylist)
      .mockResolvedValueOnce(librarySummary.likedSongs as never)
      .mockResolvedValueOnce(updatedLikedSongs as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="liked-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Quedate");

    act(() => {
      emitLikedSongsChanged();
    });

    await waitFor(() => {
      expect(screen.getByText("Nuevo pulso")).toBeInTheDocument();
      expect(screen.getByText("3 canciones")).toBeInTheDocument();
    });
  });

  it("plays liked songs from the library hero", async () => {
    const user = userEvent.setup();
    const onPlayCollectionTrack = jest.fn();

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={onPlayCollectionTrack}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Canciones que te gustan");
    await user.click(screen.getByTitle("Reproducir canciones que te gustan"));

    expect(onPlayCollectionTrack).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1" }),
      expect.any(Array),
      "liked-1"
    );
  });

  it("updates the liked songs cover from the library hero", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.updatePlaylist).mockResolvedValue({
      ...librarySummary.likedSongs,
      coverAssetId: "cover-1",
    } as never);

    const { container } = renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Canciones que te gustan");
    await user.upload(
      container.querySelector(".library-cover-action input") as HTMLInputElement,
      new File(["cover"], "liked-cover.png", { type: "image/png" })
    );

    await waitFor(() =>
      expect(libraryService.updatePlaylist).toHaveBeenCalledWith("liked-1", {
        coverAssetId: "cover-1",
      })
    );
  });

  it("shows upload errors when the liked songs cover cannot be updated", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();
    jest.mocked(mediaService.uploadPlaylistCover).mockRejectedValueOnce(new Error("forbidden"));

    const { container } = renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={toast}
      />
    );

    await screen.findByText("Canciones que te gustan");
    await user.upload(
      container.querySelector(".library-cover-action input") as HTMLInputElement,
      new File(["cover"], "liked-cover.png", { type: "image/png" })
    );

    await waitFor(() => expect(toast).toHaveBeenCalledWith("No tienes permisos para esta acción."));
  });

  it("adds playlists created from another library surface", async () => {
    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Canciones que te gustan");

    act(() => {
      emitPlaylistCreated(privatePlaylist);
    });

    expect(await screen.findByText("Road mix")).toBeInTheDocument();
  });

  it("removes playlists deleted from another library surface", async () => {
    jest.mocked(libraryService.getLibrary).mockResolvedValue({
      ...librarySummary,
      playlists: [privatePlaylist],
    } as never);

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Road mix");

    act(() => {
      emitPlaylistDeleted("playlist-1");
    });

    await waitFor(() => expect(screen.queryByText("Road mix")).not.toBeInTheDocument());
  });

  it("renames playlists updated from another library surface", async () => {
    jest.mocked(libraryService.getLibrary).mockResolvedValue({
      ...librarySummary,
      playlists: [privatePlaylist],
    } as never);

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Road mix");

    act(() => {
      emitPlaylistUpdated({ ...privatePlaylist, name: "Road mix renovada" });
    });

    expect(await screen.findByText("Road mix renovada")).toBeInTheDocument();
  });

  it("updates the liked songs summary when the system playlist event arrives", async () => {
    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Canciones que te gustan");

    act(() => {
      emitPlaylistUpdated({ ...librarySummary.likedSongs, trackCount: 1, tracks: undefined } as never);
    });

    expect(await screen.findByText(/1 canci/)).toBeInTheDocument();
  });

  it("deletes private playlists after confirmation", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getLibrary).mockResolvedValue({
      ...librarySummary,
      playlists: [privatePlaylist],
    } as never);

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByText("Road mix");
    await user.click(screen.getByTitle("Eliminar playlist"));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(libraryService.deletePlaylist).toHaveBeenCalledWith("playlist-1"));
  });

  it("shows a load error when the library request fails", async () => {
    jest.mocked(libraryService.getLibrary).mockRejectedValueOnce(new Error("not found"));

    renderWithRouter(
      <LibraryPage
        currentTrack={null}
        onPlayCollectionTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    expect(await screen.findByText("No se pudo cargar tu biblioteca")).toBeInTheDocument();
  });

  it("adds the current track to a private playlist detail", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.addTrackToPlaylist).mockResolvedValue({
      ...privatePlaylist,
      tracks: [...privatePlaylist.tracks, currentTrack],
    } as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={currentTrack}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Agregar pista actual" }));

    await waitFor(() => expect(libraryService.addTrackToPlaylist).toHaveBeenCalledWith("playlist-1", "track-3"));
  });

  it("adds songs from liked tracks in the add-songs dialog", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.getLikedSongs).mockResolvedValue({
      ...librarySummary.likedSongs,
      trackCount: 3,
      tracks: [...librarySummary.likedSongs.tracks, currentTrack],
    } as never);
    jest.mocked(libraryService.addTrackToPlaylist).mockResolvedValue({
      ...privatePlaylist,
      tracks: [...privatePlaylist.tracks, currentTrack],
    } as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Agregar canciones" }));
    await screen.findByText("Nuevo pulso");
    await user.click(screen.getAllByRole("button", { name: "Agregar canción a la playlist" })[0]);

    await waitFor(() =>
      expect(libraryService.addTrackToPlaylist).toHaveBeenCalledWith("playlist-1", "track-3")
    );
  });

  it("removes tracks from a private playlist detail", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.removeTrackFromPlaylist).mockResolvedValue({
      ...privatePlaylist,
      tracks: [privatePlaylist.tracks[1]],
    } as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: "Reproducir" });
    await user.click(screen.getAllByRole("button", { name: "Quitar" })[0]);

    await waitFor(() =>
      expect(libraryService.removeTrackFromPlaylist).toHaveBeenCalledWith("playlist-1", "track-1")
    );
  });

  it("updates private playlist covers from the detail page", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.updatePlaylist).mockResolvedValue({
      ...privatePlaylist,
      coverAssetId: "cover-1",
    } as never);

    const { container } = renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: "Reproducir" });
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.upload(
      screen.getByRole("dialog").querySelector('input[type="file"]') as HTMLInputElement,
      new File(["cover"], "cover.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(libraryService.updatePlaylist).toHaveBeenCalledWith("playlist-1", {
        name: "Road mix",
        coverAssetId: "cover-1",
      })
    );
  });

  it("keeps the playlist detail rendered after saving playlist edits from a summary response", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.updatePlaylist).mockResolvedValue({
      playlistId: "playlist-1",
      name: "Road mix renovada",
      coverAssetId: null,
      isSystem: false,
      systemKey: null,
      trackCount: 2,
      createdAt: "2026-05-24T00:00:00Z",
      updatedAt: "2026-05-25T00:00:00Z",
    } as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.clear(screen.getByLabelText("Nombre de playlist"));
    await user.type(screen.getByLabelText("Nombre de playlist"), "Road mix renovada");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Quedate")).toBeInTheDocument();
  });

  it("closes the playlist edit dialog when saving fails", async () => {
    const user = userEvent.setup();
    const toast = jest.fn();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);
    jest.mocked(libraryService.updatePlaylist).mockRejectedValueOnce(new Error("already exists"));

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={toast}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(toast).toHaveBeenCalled();
  });

  it("shows an empty search result inside private playlist details", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: "Reproducir" });
    await user.type(screen.getByPlaceholderText("Buscar en esta playlist"), "zzzz{enter}");

    expect(await screen.findByText("Sin canciones para esta búsqueda")).toBeInTheDocument();
  });

  it("keeps the add-songs search prompt visible before a song search actually runs", async () => {
    const user = userEvent.setup();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Agregar canciones" }));
    await user.click(screen.getByRole("button", { name: "Buscar canciones" }));
    await user.type(screen.getByPlaceholderText("Buscar canciones"), "ab");

    expect(screen.getByText("Busca canciones para agregarlas a esta playlist.")).toBeInTheDocument();
  });

  it("marks playlist details unavailable when the playlist is deleted elsewhere", async () => {
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: "Reproducir" });

    act(() => {
      emitPlaylistDeleted("playlist-1");
    });

    expect(await screen.findByText("Esta playlist ya no está disponible.")).toBeInTheDocument();
  });

  it("replaces playlist detail tracks when a full update event arrives", async () => {
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={jest.fn()}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: "Reproducir" });

    act(() => {
      emitPlaylistUpdated({ ...privatePlaylist, tracks: [currentTrack] });
    });

    expect(await screen.findByText("Nuevo pulso")).toBeInTheDocument();
  });

  it("plays private playlist tracks from the detail page", async () => {
    const user = userEvent.setup();
    const onPlayTrack = jest.fn();
    jest.mocked(libraryService.getPlaylist).mockResolvedValue(privatePlaylist as never);

    renderWithRouter(
      <PlaylistDetailPage
        playlistId="playlist-1"
        currentTrack={null}
        onPlayTrack={onPlayTrack}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Reproducir" }));

    expect(onPlayTrack).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1" }),
      expect.any(Array),
      "playlist-1"
    );
  });
});
