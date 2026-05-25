import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  ArtistDiscographyPage,
  ArtistProfilePage,
  HomePage,
} from "./ListenerPages";
import { analyticsService } from "../../services/analyticsService";
import { catalogService } from "../../services/catalogService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    getAlbum: jest.fn(),
    getArtist: jest.fn(),
    listArtistAlbums: jest.fn(),
    listArtistTracks: jest.fn(),
  },
}));

jest.mock("../../services/analyticsService", () => ({
  analyticsService: {
    getArtistPublicSummary: jest.fn(),
    getDiscoverySummary: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
  getAssetUrl: (assetId: string) => `https://assets/${assetId}`,
}));

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{location.pathname}</div>;
}

describe("ListenerPages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates legacy discovery items with catalog covers, profile images, and zero-play fallbacks", async () => {
    jest.mocked(analyticsService.getDiscoverySummary).mockResolvedValue({
      topAlbums: [
        {
          albumId: "album-legacy",
          artistId: "artist-1",
          title: "Unknown album",
          artistName: "Artista",
          coverAssetId: null,
          plays: 0,
        },
      ],
      topArtists: [
        {
          artistId: "artist-1",
          artistName: "Unknown artist",
          plays: 0,
          uniqueListeners: 0,
        },
      ],
    });
    jest.mocked(catalogService.getAlbum).mockResolvedValue({
      albumId: "album-legacy",
      artistId: "artist-1",
      title: "Álbum legado",
      coverAssetId: "cover-legacy",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Ada",
      biography: null,
      profileImageAssetId: "profile-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Álbum legado")).toBeInTheDocument();
    expect(await screen.findAllByText("Ada")).toHaveLength(2);
    expect(screen.queryByText("Artista")).not.toBeInTheDocument();
    expect(screen.queryByText(/reproducciones/i)).not.toBeInTheDocument();
    expect(catalogService.getAlbum).toHaveBeenCalledWith("album-legacy");
    expect(container.querySelector('img[src="https://assets/cover-legacy"]')).not.toBeNull();
    expect(container.querySelector('img[src="https://assets/profile-1"]')).not.toBeNull();
  });

  it("shows the track genre in artist top songs and exposes discography navigation even for singles", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Ada",
      biography: "Bio",
      profileImageAssetId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([]);
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Quédate",
        genre: "Balada",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    jest.mocked(analyticsService.getArtistPublicSummary).mockResolvedValue({
      artistId: "artist-1",
      totalPlays: 9,
      averageDailyPlays: 3,
      averageDailyUniqueListeners: 2,
      tracks: [
        {
          trackId: "track-1",
          title: "Quédate",
          artistId: "artist-1",
          artistName: "Ada",
          plays: 9,
          uniqueListeners: 2,
        },
      ],
      topTracks: [
        {
          trackId: "track-1",
          title: "Quédate",
          artistId: "artist-1",
          artistName: "Ada",
          plays: 9,
          uniqueListeners: 2,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/artists/artist-1"]}>
        <LocationProbe />
        <ArtistProfilePage
          artistId="artist-1"
          currentUser={{ id: "listener-1", role: "listener", username: "Listener" }}
          currentTrack={null}
          onPlayTrack={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText("Balada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todo" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/artists/artist-1/discography");
    });
  });

  it("renders discography newest-first and keeps singles playable", async () => {
    const onPlayTrack = jest.fn();
    const user = userEvent.setup();
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Ada",
      biography: "Bio",
      profileImageAssetId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([
      {
        albumId: "album-old",
        artistId: "artist-1",
        title: "Álbum viejo",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        albumId: "album-new",
        artistId: "artist-1",
        title: "Álbum nuevo",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([
      {
        trackId: "single-old",
        artistId: "artist-1",
        albumId: null,
        title: "Single viejo",
        genre: "Pop",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        trackId: "single-new",
        artistId: "artist-1",
        albumId: null,
        title: "Single nuevo",
        genre: "Rock",
        audioAssetId: "audio-2",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <ArtistDiscographyPage
          artistId="artist-1"
          currentUser={{ id: "listener-1", role: "listener", username: "Listener" }}
          currentTrack={null}
          onPlayTrack={onPlayTrack}
        />
      </MemoryRouter>
    );

    const newerAlbum = await screen.findByText("Álbum nuevo");
    const olderAlbum = screen.getByText("Álbum viejo");
    const newerSingle = screen.getByText("Single nuevo");
    const olderSingle = screen.getByText("Single viejo");

    expect(newerAlbum.compareDocumentPosition(olderAlbum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(newerSingle.compareDocumentPosition(olderSingle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(newerSingle);

    expect(onPlayTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: "single-new",
        artist: "Ada",
      })
    );
  });
});
