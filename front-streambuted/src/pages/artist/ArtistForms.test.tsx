import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateAlbumPage, EditTrackPage, MyAlbumsPage, MyTracksPage, UploadSinglePage } from "./ArtistPages";
import { catalogService } from "../../services/catalogService";
import { mediaService } from "../../services/mediaService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    createTrack: jest.fn(),
    createTrackInAlbum: jest.fn(),
    updateTrack: jest.fn(),
    createAlbum: jest.fn(),
    listArtistAlbums: jest.fn(),
    listArtistTracks: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
  getAssetUrl: jest.fn((assetId: string) => `http://localhost/api/v1/media/assets/${assetId}`),
  mediaService: {
    uploadAudio: jest.fn(),
    uploadCatalogImage: jest.fn(),
  },
}));

describe("artist upload forms", () => {
  beforeEach(() => {
    jest.mocked(mediaService.uploadAudio).mockResolvedValue({
      assetId: "audio-1",
      assetType: "AUDIO",
      contentType: "audio/mpeg",
      sizeBytes: 100,
      durationSeconds: 180,
    });
    jest.mocked(mediaService.uploadCatalogImage).mockResolvedValue({
      assetId: "cover-1",
      assetType: "TRACK_COVER",
      contentType: "image/png",
      sizeBytes: 100,
    });
    jest.mocked(catalogService.createTrack).mockResolvedValue({} as never);
    jest.mocked(catalogService.createTrackInAlbum).mockResolvedValue({} as never);
    jest.mocked(catalogService.updateTrack).mockResolvedValue({} as never);
    jest.mocked(catalogService.createAlbum).mockResolvedValue({
      albumId: "album-1",
      artistId: "artist-1",
      title: "Album",
      coverAssetId: "album-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([]);
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([]);
  });

  it("uploads media before creating a track", async () => {
    const user = userEvent.setup();
    const { container } = render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);
    const [audioInput, coverInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await user.type(screen.getByPlaceholderText("Enter track title"), "Song");
    await user.type(screen.getByPlaceholderText("Rock, Pop, Electronica..."), "Rock");
    await user.upload(audioInput, new File(["audio"], "song.mp3", { type: "audio/mpeg" }));
    await user.upload(coverInput, new File(["cover"], "cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publish Single" }));

    await waitFor(() => {
      expect(mediaService.uploadAudio).toHaveBeenCalled();
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "TRACK_COVER");
      expect(catalogService.createTrack).toHaveBeenCalledWith({
        albumId: null,
        title: "Song",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: "cover-1",
        durationSeconds: 180,
      });
    });
  });

  it("uploads cover before creating an album", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const [coverInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await user.type(screen.getByPlaceholderText("Enter album title"), "Album");
    await user.upload(coverInput, new File(["cover"], "cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar Album" }));

    await waitFor(() => {
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "ALBUM_COVER");
      expect(catalogService.createAlbum).toHaveBeenCalledWith({
        title: "Album",
        coverAssetId: "cover-1",
      });
    });
  });

  it("creates the album first and then adds tracks with their own cover asset", async () => {
    const user = userEvent.setup();
    jest.mocked(mediaService.uploadCatalogImage).mockImplementation(async (_file, usage) => ({
      assetId: usage === "ALBUM_COVER" ? "album-cover-1" : "track-cover-1",
      assetType: usage,
      contentType: "image/png",
      sizeBytes: 100,
    }));
    jest.mocked(catalogService.createAlbum).mockResolvedValue({
      albumId: "album-1",
      title: "Album con canciones",
      coverAssetId: "album-cover-1",
      artistId: "artist-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
    jest.mocked(catalogService.createTrackInAlbum).mockResolvedValue({
      trackId: "track-1",
      artistId: "artist-1",
      albumId: "album-1",
      title: "Cancion 1",
      genre: "Rock",
      audioAssetId: "audio-1",
      coverAssetId: "track-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);

    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const albumCoverInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.type(screen.getByPlaceholderText("Enter album title"), "Album con canciones");
    await user.upload(albumCoverInput, new File(["cover"], "album-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar Album" }));

    await waitFor(() => {
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "ALBUM_COVER");
      expect(catalogService.createAlbum).toHaveBeenCalledWith({
        title: "Album con canciones",
        coverAssetId: "album-cover-1",
      });
      expect(catalogService.createTrackInAlbum).not.toHaveBeenCalled();
    });

    await screen.findByText('Album "Album con canciones" creado. Ahora puedes agregar canciones con portada propia.');

    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const trackAudioInput = fileInputs[1];
    const trackCoverInput = fileInputs[2];

    await user.type(screen.getByPlaceholderText("Titulo de la cancion"), "Cancion 1");
    await user.type(screen.getByPlaceholderText("Rock, Pop, Electronica..."), "Rock");
    await user.upload(trackAudioInput, new File(["audio"], "track-1.mp3", { type: "audio/mpeg" }));
    await user.upload(trackCoverInput, new File(["cover"], "track-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Agregar cancion" }));

    await waitFor(() => {
      expect(mediaService.uploadAudio).toHaveBeenCalledWith(expect.any(File));
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "TRACK_COVER");
      expect(catalogService.createTrackInAlbum).toHaveBeenCalledWith("album-1", {
        title: "Cancion 1",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: "track-cover-1",
        durationSeconds: 180,
      });
    });
  });

  it("sends null albumId when editing a track back to single", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Album",
        coverAssetId: "cover-1",
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    render(
      <EditTrackPage
        track={{
          trackId: "track-1",
          artistId: "artist-1",
          albumId: "album-1",
          title: "Song",
          genre: "Rock",
          audioAssetId: "audio-1",
          coverAssetId: "cover-1",
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        user={{ id: "artist-1" }}
        setPage={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.selectOptions(await screen.findByLabelText("Album"), "");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(catalogService.updateTrack).toHaveBeenCalledWith("track-1", {
        title: "Song",
        genre: "Rock",
        albumId: null,
      });
    });
  });

  it("renders track and album covers in artist tables", async () => {
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Song",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: "track-cover-1",
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Album",
        coverAssetId: "album-cover-1",
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const { rerender } = render(
      <MyTracksPage user={{ id: "artist-1" }} setPage={jest.fn()} setEditTrack={jest.fn()} toast={jest.fn()} />
    );

    expect(await screen.findByAltText("Portada de Song")).toHaveAttribute(
      "src",
      "http://localhost/api/v1/media/assets/track-cover-1"
    );

    rerender(
      <MyAlbumsPage user={{ id: "artist-1" }} setPage={jest.fn()} setUploadAlbumId={jest.fn()} toast={jest.fn()} />
    );

    expect(await screen.findByAltText("Portada de Album")).toHaveAttribute(
      "src",
      "http://localhost/api/v1/media/assets/album-cover-1"
    );
  });
});
