import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AlbumDetailPage, ArtistProfilePage } from "./ListenerPages";
import { catalogService } from "../../services/catalogService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    getArtist: jest.fn(),
    getAlbum: jest.fn(),
    listArtistAlbums: jest.fn(),
    listArtistTracks: jest.fn(),
    listAlbumTracks: jest.fn(),
  },
}));

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("AlbumDetailPage", () => {
  it("loads real album tracks and starts album playback context", async () => {
    const user = userEvent.setup();
    const onPlayTrack = jest.fn();
    jest.mocked(catalogService.getAlbum).mockResolvedValue({
      albumId: "album-1",
      artistId: "artist-1",
      title: "Night Drive",
      coverAssetId: null,
      status: "PUBLICADO",
      createdAt: "2026-05-11T00:00:00Z",
      updatedAt: "2026-05-11T00:00:00Z",
    });
    jest.mocked(catalogService.listAlbumTracks).mockResolvedValue({
      albumId: "album-1",
      tracks: [
        {
          trackId: "track-1",
          artistId: "artist-1",
          albumId: "album-1",
          title: "Midnight Signals",
          genre: "Electronica",
          audioAssetId: "asset-1",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-05-11T00:00:00Z",
          updatedAt: "2026-05-11T00:00:00Z",
        },
        {
          trackId: "track-2",
          artistId: "artist-1",
          albumId: "album-1",
          title: "Late Lights",
          genre: "Pop",
          audioAssetId: "asset-2",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-05-11T00:00:00Z",
          updatedAt: "2026-05-11T00:00:00Z",
        },
      ],
    });

    renderWithRouter(
      <AlbumDetailPage
        albumId="album-1"
        onPlayTrack={onPlayTrack}
        currentTrack={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Midnight Signals")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Midnight Signals"));

    expect(onPlayTrack).toHaveBeenCalledWith(
      expect.objectContaining({ trackId: "track-1" }),
      expect.arrayContaining([
        expect.objectContaining({ trackId: "track-1" }),
        expect.objectContaining({ trackId: "track-2" }),
      ]),
      "album-1"
    );
  });
});

describe("ArtistProfilePage", () => {
  it("shows an edit link when the profile belongs to the current artist", async () => {
    jest.mocked(catalogService.getArtist).mockResolvedValue({
      artistId: "artist-1",
      displayName: "Urielito",
      biography: "Long live sahur",
      profileImageAssetId: null,
    } as never);
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([] as never);
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([] as never);

    renderWithRouter(
      <ArtistProfilePage
        artistId="artist-1"
        currentUser={{ id: "artist-1", role: "artist" }}
        onPlayTrack={jest.fn()}
        currentTrack={null}
      />
    );

    expect(await screen.findByText("Urielito")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute("href", "/settings");
  });
});
