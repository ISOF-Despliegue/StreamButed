import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  ArtistAnalyticsPage,
  ArtistDashboardPage,
  CreateAlbumPage,
  EditTrackPage,
  MyAlbumsPage,
  MyTracksPage,
  UploadSinglePage,
} from "./ArtistPages";
import { analyticsService } from "../../services/analyticsService";
import { catalogService } from "../../services/catalogService";
import { getUploadFileNameError, mediaService } from "../../services/mediaService";

jest.mock("../../services/analyticsService", () => ({
  analyticsService: {
    getArtistSummary: jest.fn(),
  },
}));

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    createTrack: jest.fn(),
    createTrackInAlbum: jest.fn(),
    updateTrack: jest.fn(),
    createAlbum: jest.fn(),
    getAlbum: jest.fn(),
    listManagedArtistAlbums: jest.fn(),
    listManagedArtistTracks: jest.fn(),
    listArtistAlbums: jest.fn(),
    listArtistTracks: jest.fn(),
    deleteAlbum: jest.fn(),
    deleteTrack: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
  getAssetUrl: jest.fn((assetId: string) => `http://localhost/api/v1/media/assets/${assetId}`),
  getUploadFileHelperText: jest.fn((example: string) => `Ejemplo: ${example}.`),
  getUploadFileNameError: jest.fn(() => ""),
  mediaService: {
    uploadAudio: jest.fn(),
    uploadCatalogImage: jest.fn(),
  },
}));

const artistAnalyticsSummary = {
  artistId: "artist-1",
  totalPlays: 42,
  averageDailyPlays: 6,
  averageDailyUniqueListeners: 3,
  topTracks: [
    {
      trackId: "track-1",
      title: "Luna",
      plays: 22,
      uniqueListeners: 9,
    },
  ],
  tracks: [
    {
      trackId: "track-1",
      title: "Luna",
      plays: 22,
      uniqueListeners: 9,
    },
  ],
};

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("artist upload forms", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
    jest.mocked(catalogService.deleteAlbum).mockResolvedValue({} as never);
    jest.mocked(catalogService.deleteTrack).mockResolvedValue({} as never);
    jest.mocked(analyticsService.getArtistSummary).mockResolvedValue(artistAnalyticsSummary as never);
    jest.mocked(catalogService.createAlbum).mockResolvedValue({
      albumId: "album-1",
      artistId: "artist-1",
      title: "Album",
      coverAssetId: "album-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
    jest.mocked(catalogService.getAlbum).mockResolvedValue({
      albumId: "album-1",
      artistId: "artist-1",
      title: "Locked Album",
      coverAssetId: "album-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([]);
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([]);
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([]);
    jest.mocked(catalogService.listArtistTracks).mockResolvedValue([]);
    jest.mocked(getUploadFileNameError).mockReturnValue("");
  });

  it("renders artist dashboard and analytics summaries", async () => {
    const dashboard = renderWithRouter(
      <ArtistDashboardPage
        currentTrack={null}
        onPlayTrack={jest.fn()}
        user={{ id: "artist-1", username: "Ada" }}
      />
    );

    expect(await screen.findAllByText("Reproducciones")).not.toHaveLength(0);
    expect(screen.getByText("Canciones principales")).toBeInTheDocument();
    expect(screen.getByText("Luna")).toBeInTheDocument();

    dashboard.unmount();

    render(<ArtistAnalyticsPage user={{ id: "artist-1", username: "Ada" }} />);

    expect(await screen.findByText("Reproducciones totales")).toBeInTheDocument();
    expect(screen.getAllByText("Luna")).not.toHaveLength(0);
    expect(analyticsService.getArtistSummary).toHaveBeenCalledWith("artist-1");
  });

  it("keeps artist dashboard usable when analytics are temporarily unavailable", async () => {
    jest.mocked(analyticsService.getArtistSummary).mockRejectedValueOnce(new Error("analytics down"));

    renderWithRouter(
      <ArtistDashboardPage
        currentTrack={null}
        onPlayTrack={jest.fn()}
        user={{ id: "artist-1", username: "Ada" }}
      />
    );

    expect(await screen.findByText(/temporalmente/)).toBeInTheDocument();
  });

  it("counts only published tracks in the artist dashboard summary", async () => {
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Publicada",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        trackId: "track-2",
        artistId: "artist-1",
        albumId: null,
        title: "Retirada",
        genre: "Rock",
        audioAssetId: "audio-2",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    renderWithRouter(
      <ArtistDashboardPage
        currentTrack={null}
        onPlayTrack={jest.fn()}
        user={{ id: "artist-1", username: "Ada" }}
      />
    );

    expect(
      within((await screen.findByText("Pistas publicadas")).closest(".stat-card") as HTMLElement).getByText("1")
    ).toBeInTheDocument();
  });

  it("uploads media before creating a track", async () => {
    const user = userEvent.setup();
    const { container } = render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);
    const [audioInput, coverInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await user.type(screen.getByPlaceholderText("Título de la canción"), "Song");
    await user.type(screen.getByPlaceholderText("Rock, Pop, Electrónica..."), "Rock");
    await user.upload(audioInput, new File(["audio"], "song.mp3", { type: "audio/mpeg" }));
    await user.upload(coverInput, new File(["cover"], "cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar canción" }));

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

  it("shows a clear filename error before uploading media", async () => {
    const user = userEvent.setup();
    jest.mocked(getUploadFileNameError).mockReturnValueOnce(
      "El nombre del archivo solo puede usar letras sin acentos, números, guiones, guion bajo y puntos. Ejemplo válido: mi-cancion-01.mp3."
    );
    const { container } = render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);
    const [audioInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    jest.mocked(mediaService.uploadAudio).mockClear();
    await user.upload(audioInput, new File(["audio"], "canción bonita.mp3", { type: "audio/mpeg" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El nombre del archivo solo puede usar letras sin acentos");
    expect(mediaService.uploadAudio).not.toHaveBeenCalled();
  });

  it("shows an audio format error before uploading an unsupported file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);
    const [audioInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await user.upload(audioInput, new File(["audio"], "song.exe", { type: "" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Formato de audio inv");
  });

  it("shows one required-fields error when publishing a track with missing fields", async () => {
    const user = userEvent.setup();

    render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);

    await user.click(screen.getByRole("button", { name: "Publicar canción" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son obligatorios.");
    expect(mediaService.uploadAudio).not.toHaveBeenCalled();
    expect(catalogService.createTrack).not.toHaveBeenCalled();
  });

  it("adds a new upload directly to the locked album route", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <UploadSinglePage
        initialAlbumId="album-1"
        onUploadAlbumConsumed={jest.fn()}
        toast={jest.fn()}
        user={{ id: "artist-1" }}
      />
    );
    const [audioInput, coverInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await screen.findByText("Locked Album");
    await user.type(screen.getByLabelText(/T.tulo de la canci.n/i), "Album Song");
    await user.type(screen.getByPlaceholderText(/Rock, Pop/i), "Rock");
    await user.upload(audioInput, new File(["audio"], "album-song.mp3", { type: "audio/mpeg" }));
    await user.upload(coverInput, new File(["cover"], "album-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: /Publicar canci.n/ }));

    await waitFor(() => expect(catalogService.createTrackInAlbum).toHaveBeenCalledWith("album-1", expect.any(Object)));
  });

  it("uploads cover before creating an album", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const [coverInput] = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];

    await user.type(screen.getByPlaceholderText("Título del álbum"), "Album");
    await user.upload(coverInput, new File(["cover"], "cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar álbum" }));

    await waitFor(() => {
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "ALBUM_COVER");
      expect(catalogService.createAlbum).toHaveBeenCalledWith({
        title: "Album",
        coverAssetId: "cover-1",
      });
    });
  });

  it("shows one required-fields error when creating an album with missing fields", async () => {
    const user = userEvent.setup();

    render(<CreateAlbumPage toast={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Publicar álbum" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son obligatorios.");
    expect(mediaService.uploadCatalogImage).not.toHaveBeenCalled();
    expect(catalogService.createAlbum).not.toHaveBeenCalled();
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
    jest.mocked(catalogService.createTrackInAlbum).mockImplementation(async (_albumId, request) => ({
      trackId: request.title === "Cancion 2" ? "track-2" : "track-1",
      artistId: "artist-1",
      albumId: "album-1",
      title: request.title,
      genre: request.genre,
      audioAssetId: "audio-1",
      coverAssetId: "track-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never));

    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const albumCoverInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.type(screen.getByPlaceholderText("Título del álbum"), "Album con canciones");
    await user.upload(albumCoverInput, new File(["cover"], "album-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar álbum" }));

    await waitFor(() => {
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "ALBUM_COVER");
      expect(catalogService.createAlbum).toHaveBeenCalledWith({
        title: "Album con canciones",
        coverAssetId: "album-cover-1",
      });
      expect(catalogService.createTrackInAlbum).not.toHaveBeenCalled();
    });

    await screen.findByText(
      'Álbum "Album con canciones" creado. Ahora puedes agregar canciones con portada propia.'
    );
    expect(screen.getByText("Agregar canción a Album con canciones")).toBeInTheDocument();
    expect(screen.queryByLabelText("Título del álbum")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mostrar crear otro/ })).toHaveTextContent("+");

    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const trackAudioInput = fileInputs[0];
    const trackCoverInput = fileInputs[1];

    await user.type(screen.getByPlaceholderText("Título de la canción"), "Cancion 1");
    await user.type(screen.getByPlaceholderText("Rock, Pop, Electrónica..."), "Rock");
    await user.upload(trackAudioInput, new File(["audio"], "track-1.mp3", { type: "audio/mpeg" }));
    await user.upload(trackCoverInput, new File(["cover"], "track-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Agregar canción" }));

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

    expect(trackAudioInput.value).toBe("");
    expect(trackCoverInput.value).toBe("");

    await user.type(screen.getByPlaceholderText("Título de la canción"), "Cancion 2");
    await user.type(screen.getByPlaceholderText("Rock, Pop, Electrónica..."), "Pop");
    await user.upload(trackAudioInput, new File(["audio"], "track-2.mp3", { type: "audio/mpeg" }));
    await user.upload(trackCoverInput, new File(["cover"], "track-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Agregar canción" }));

    await waitFor(() => {
      expect(catalogService.createTrackInAlbum).toHaveBeenCalledTimes(2);
    });
  });

  it("shows one required-fields error when adding a song to an album with missing fields", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.createAlbum).mockResolvedValue({
      albumId: "album-1",
      title: "Album con canciones",
      coverAssetId: "album-cover-1",
      artistId: "artist-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never);

    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const albumCoverInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.type(screen.getByPlaceholderText("Título del álbum"), "Album con canciones");
    await user.upload(albumCoverInput, new File(["cover"], "album-cover.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Publicar álbum" }));

    await screen.findByText('Álbum "Album con canciones" creado. Ahora puedes agregar canciones con portada propia.');
    await user.click(screen.getByRole("button", { name: "Agregar canción" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son obligatorios.");
    expect(catalogService.createTrackInAlbum).not.toHaveBeenCalled();
  });

  it("expands create another album action and returns to fresh album form", async () => {
    const user = userEvent.setup();
    const { container } = render(<CreateAlbumPage toast={jest.fn()} />);
    const albumCoverInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.type(screen.getByPlaceholderText("Título del álbum"), "Album");
    await user.upload(
      albumCoverInput,
      new File(["cover"], "album-cover.png", { type: "image/png" })
    );
    await user.click(screen.getByRole("button", { name: "Publicar álbum" }));

    await screen.findByText(
      'Álbum "Album" creado. Ahora puedes agregar canciones con portada propia.'
    );
    const plusButton = screen.getByRole("button", { name: /Mostrar crear otro/ });

    expect(screen.queryByRole("button", { name: /Crear otro/ })).not.toBeInTheDocument();

    await user.hover(plusButton);
    await user.click(plusButton);

    const createAnother = await screen.findByRole("button", { name: /Crear otro/ });
    expect(createAnother).toBeInTheDocument();

    await user.click(createAnother);

    expect(await screen.findByLabelText("Título del álbum")).toBeInTheDocument();
    expect(screen.queryByText("Agregar canción a Album")).not.toBeInTheDocument();
  });

  it("sends null albumId when editing a track back to single", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
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
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.selectOptions(await screen.findByLabelText("Álbum"), "");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(catalogService.updateTrack).toHaveBeenCalledWith("track-1", {
        title: "Song",
        genre: "Rock",
        albumId: null,
      });
    });
  });

  it("uploads a new cover when editing a track", async () => {
    const user = userEvent.setup();
    jest.mocked(mediaService.uploadCatalogImage).mockResolvedValueOnce({
      assetId: "new-cover",
      assetType: "TRACK_COVER",
      contentType: "image/png",
      sizeBytes: 100,
    });

    const { container } = render(
      <EditTrackPage
        track={{
          trackId: "track-1",
          artistId: "artist-1",
          albumId: null,
          title: "Song",
          genre: "Rock",
          audioAssetId: "audio-1",
          coverAssetId: "cover-1",
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        user={{ id: "artist-1" }}
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    const coverInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(coverInput, new File(["cover"], "portada-01.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(mediaService.uploadCatalogImage).toHaveBeenCalledWith(expect.any(File), "TRACK_COVER");
      expect(catalogService.updateTrack).toHaveBeenCalledWith("track-1", {
        title: "Song",
        genre: "Rock",
        albumId: null,
        coverAssetId: "new-cover",
      });
    });
  });

  it("closes the edit confirmation dialog when saving a track fails", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.updateTrack).mockRejectedValueOnce(new Error("forbidden"));

    render(
      <EditTrackPage
        track={{
          trackId: "track-1",
          artistId: "artist-1",
          albumId: null,
          title: "Song",
          genre: "Rock",
          audioAssetId: "audio-1",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        user={{ id: "artist-1" }}
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("renders track and album covers in artist tables", async () => {
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
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
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
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

    const tracksPage = renderWithRouter(
      <MyTracksPage user={{ id: "artist-1" }} toast={jest.fn()} />
    );

    expect(await screen.findByAltText("Portada de Song")).toHaveAttribute(
      "src",
      "http://localhost/api/v1/media/assets/track-cover-1"
    );

    tracksPage.unmount();

    renderWithRouter(
      <MyAlbumsPage user={{ id: "artist-1" }} toast={jest.fn()} />
    );

    expect(await screen.findByAltText("Portada de Album")).toHaveAttribute(
      "src",
      "http://localhost/api/v1/media/assets/album-cover-1"
    );
  });

  it("deletes a track after the artist confirms the action", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Song",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);
    renderWithRouter(<MyTracksPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar pista" }));

    await waitFor(() => expect(catalogService.deleteTrack).toHaveBeenCalledWith("track-1"));
  });

  it("hides retired albums from the edit-track selector", async () => {
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Publicado",
        coverAssetId: "cover-1",
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        albumId: "album-2",
        artistId: "artist-1",
        title: "Retirado",
        coverAssetId: "cover-2",
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    render(
      <EditTrackPage
        track={{
          trackId: "track-1",
          artistId: "artist-1",
          albumId: null,
          title: "Song",
          genre: "Rock",
          audioAssetId: "audio-1",
          coverAssetId: "cover-1",
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        user={{ id: "artist-1" }}
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    expect(await screen.findByRole("option", { name: "Publicado" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Retirado" })).not.toBeInTheDocument();
  });

  it("deletes an album after the artist confirms the action", async () => {
    const user = userEvent.setup();
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Album",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);
    renderWithRouter(<MyAlbumsPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    await user.click(await screen.findByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Eliminar/ }));

    await waitFor(() => expect(catalogService.deleteAlbum).toHaveBeenCalledWith("album-1"));
  });

  it("keeps admin-retired tracks visible to the artist", async () => {
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Song",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    renderWithRouter(<MyTracksPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    expect(await screen.findByText("Retirado")).toBeInTheDocument();
  });

  it("disables edit for retired tracks in my tracks", async () => {
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: null,
        title: "Song",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    renderWithRouter(<MyTracksPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    expect(await screen.findByRole("button", { name: "Editar" })).toBeDisabled();
  });

  it("disables add track for retired albums in my albums", async () => {
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Album",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    renderWithRouter(<MyAlbumsPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    expect(await screen.findByRole("button", { name: "Agregar canción" })).toBeDisabled();
  });

  it("shows only published tracks in the album count", async () => {
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Album",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);
    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([
      {
        trackId: "track-1",
        artistId: "artist-1",
        albumId: "album-1",
        title: "Publicada",
        genre: "Rock",
        audioAssetId: "audio-1",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        trackId: "track-2",
        artistId: "artist-1",
        albumId: "album-1",
        title: "Retirada",
        genre: "Rock",
        audioAssetId: "audio-2",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    renderWithRouter(<MyAlbumsPage user={{ id: "artist-1" }} toast={jest.fn()} />);

    expect(await screen.findByText("1")).toBeInTheDocument();
  });

  it("hides retired albums from the upload album selector", async () => {
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Publicado",
        coverAssetId: null,
        status: "PUBLICADO",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        albumId: "album-2",
        artistId: "artist-1",
        title: "Retirado",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    render(<UploadSinglePage toast={jest.fn()} user={{ id: "artist-1" }} />);

    expect(await screen.findByRole("option", { name: "Publicado" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Retirado" })).not.toBeInTheDocument();
  });

  it("blocks publishing into a retired locked album", async () => {
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([
      {
        albumId: "album-1",
        artistId: "artist-1",
        title: "Retirado",
        coverAssetId: null,
        status: "RETIRADO",
        visibilityReason: "ADMIN_RETIRED",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never);

    render(
      <UploadSinglePage
        initialAlbumId="album-1"
        onUploadAlbumConsumed={jest.fn()}
        toast={jest.fn()}
        user={{ id: "artist-1" }}
      />
    );

    expect(await screen.findByText(/no acepta canciones nuevas/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Publicar canción" })).toBeDisabled();
  });

  it("shows the empty analytics breakdown when an artist has no tracked songs", async () => {
    jest.mocked(analyticsService.getArtistSummary).mockResolvedValueOnce({
      ...artistAnalyticsSummary,
      topTracks: [],
      tracks: [],
    } as never);

    render(<ArtistAnalyticsPage user={{ id: "artist-1", username: "Ada" }} />);

    expect(await screen.findByText(/Sin canciones/)).toBeInTheDocument();
  });

  it("shows a safe empty state when editing a missing track", () => {
    render(
      <EditTrackPage
        track={{} as never}
        user={{} as never}
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    expect(screen.getByText(/Selecciona una pista real/)).toBeInTheDocument();
  });

  it("deletes a track from the edit page after confirmation", async () => {
    const user = userEvent.setup();
    render(
      <EditTrackPage
        track={{
          trackId: "track-1",
          artistId: "artist-1",
          albumId: null,
          title: "Song",
          genre: "Rock",
          audioAssetId: "audio-1",
          coverAssetId: null,
          status: "PUBLICADO",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }}
        user={{ id: "artist-1" }}
        onCancel={jest.fn()}
        onDone={jest.fn()}
        toast={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Eliminar pista" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar pista" }));

    await waitFor(() => expect(catalogService.deleteTrack).toHaveBeenCalledWith("track-1"));
  });

  it("plays tracks from artist track table and opens albums without embedded track playback", async () => {
    const user = userEvent.setup();
    const singleTrack = {
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
    };
    const albumTrack = {
      trackId: "track-2",
      artistId: "artist-1",
      albumId: "album-1",
      title: "Lado B",
      genre: "Pop",
      audioAssetId: "audio-2",
      coverAssetId: "track-cover-2",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const album = {
      albumId: "album-1",
      artistId: "artist-1",
      title: "Album",
      coverAssetId: "album-cover-1",
      status: "PUBLICADO",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    jest.mocked(catalogService.listManagedArtistTracks).mockResolvedValue([singleTrack, albumTrack] as never);
    jest.mocked(catalogService.listManagedArtistAlbums).mockResolvedValue([album] as never);

    const onPlayTrack = jest.fn();
    const tracksPage = renderWithRouter(
      <MyTracksPage
        currentTrack={null}
        onPlayTrack={onPlayTrack}
        user={{ id: "artist-1", username: "Ada" }}
        toast={jest.fn()}
      />
    );

    await user.click(await screen.findByRole("button", { name: "Reproducir Song" }));

    expect(onPlayTrack).toHaveBeenCalledWith(expect.objectContaining({
      artist: "Ada",
      trackId: "track-1",
    }));

    tracksPage.unmount();

    const onPlayAlbumTrack = jest.fn();
    renderWithRouter(
      <MyAlbumsPage
        currentTrack={null}
        onPlayTrack={onPlayAlbumTrack}
        user={{ id: "artist-1", username: "Ada" }}
        toast={jest.fn()}
      />
    );

    await screen.findByRole("button", { name: /Album/ });

    expect(screen.queryByRole("button", { name: "Reproducir Lado B" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reproducir" })).not.toBeInTheDocument();
    expect(onPlayAlbumTrack).not.toHaveBeenCalled();
  });
});
