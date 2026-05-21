import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { SearchPage } from "./ListenerPages";
import { catalogService } from "../../services/catalogService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    searchCatalog: jest.fn(),
    getArtist: jest.fn(),
    getAlbum: jest.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithRouter(ui: React.ReactNode) {
  return render(
    <MemoryRouter>
      <LocationProbe />
      {ui}
    </MemoryRouter>
  );
}

describe("SearchPage", () => {
  it("calls catalog search endpoint through service", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [],
      albums: [],
      tracks: [],
    });

    renderWithRouter(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, álbumes..."), "night");

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

    renderWithRouter(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, álbumes..."), "noche");

    expect(await screen.findByText("Género")).toBeInTheDocument();
    expect(screen.getByText("Álbum")).toBeInTheDocument();
    expect(screen.getByText("Pop")).toBeInTheDocument();
    expect(screen.getByText("Sencillo")).toBeInTheDocument();
    expect(screen.getByText("Rock")).toBeInTheDocument();
    expect(screen.getByText("Album Morado")).toBeInTheDocument();
  });

  it("navigates to real album and artist routes from search results", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.searchCatalog).mockResolvedValue({
      artists: [
        {
          artistId: "artist-1",
          displayName: "Artista Uno",
          biography: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      albums: [
        {
          albumId: "album-1",
          artistId: "artist-1",
          title: "Album Uno",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      tracks: [],
    });
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Artista Uno",
      biography: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderWithRouter(
      <SearchPage
        onPlayTrack={jest.fn()}
        currentTrack={null}
      />
    );

    await user.type(screen.getByPlaceholderText("Busca canciones, artistas, álbumes..."), "uno");

    await screen.findByText("Album Uno");

    await user.click(screen.getAllByRole("button", { name: /Artista Uno/ })[0]);
    expect(screen.getByTestId("location")).toHaveTextContent("/artists/artist-1");

    await user.click(screen.getByRole("button", { name: /Album Uno/ }));
    expect(screen.getByTestId("location")).toHaveTextContent("/albums/album-1");
  });
});
