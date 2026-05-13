import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPage } from "./ListenerPages";
import { catalogService } from "../../services/catalogService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    searchCatalog: jest.fn(),
    getArtist: jest.fn(),
    getAlbum: jest.fn(),
  },
}));

describe("SearchPage", () => {
  it("calls catalog search endpoint through service", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [],
    });

    render(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
        setPage={jest.fn()}
        setViewAlbum={jest.fn()}
        setViewArtist={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, albums..."), "night");

    await waitFor(() => {
      expect(catalogService.searchCatalog).toHaveBeenCalledWith({
        q: "night",
        limit: 20,
        offset: 0,
      });
    });
  });

  it("shows genre and album context for track search results", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [
        {
          trackId: "track-single",
          artistId: "artist-1",
          albumId: null,
          title: "Luz",
          genre: "Pop",
          audioAssetId: "audio-1",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          trackId: "track-album",
          artistId: "artist-1",
          albumId: "album-1",
          title: "Noche",
          genre: "Rock",
          audioAssetId: "audio-2",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Artista Uno",
      biography: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    jest.mocked(catalogService.getAlbum).mockResolvedValue({
      albumId: "album-1",
      artistId: "artist-1",
      title: "Album Morado",
      coverAssetId: null,
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    render(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
        setPage={jest.fn()}
        setViewAlbum={jest.fn()}
        setViewArtist={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, albums..."), "noche");

    expect(await screen.findByText("Genero")).toBeInTheDocument();
    expect(screen.getByText("Album")).toBeInTheDocument();
    expect(screen.getByText("Pop")).toBeInTheDocument();
    expect(screen.getByText("Single")).toBeInTheDocument();
    expect(screen.getByText("Rock")).toBeInTheDocument();
    expect(screen.getByText("Album Morado")).toBeInTheDocument();
  });
});
