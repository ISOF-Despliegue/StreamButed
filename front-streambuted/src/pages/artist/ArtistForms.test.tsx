import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateAlbumPage, UploadSinglePage } from "./ArtistPages";
import { catalogService } from "../../services/catalogService";
import { mediaService } from "../../services/mediaService";

jest.mock("../../services/catalogService", () => ({
  catalogService: {
    createTrack: jest.fn(),
    createTrackInAlbum: jest.fn(),
    createAlbum: jest.fn(),
    listArtistAlbums: jest.fn(),
  },
}));

jest.mock("../../services/mediaService", () => ({
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
    });
    jest.mocked(mediaService.uploadCatalogImage).mockResolvedValue({
      assetId: "cover-1",
      assetType: "TRACK_COVER",
      contentType: "image/png",
      sizeBytes: 100,
    });
    jest.mocked(catalogService.createTrack).mockResolvedValue({} as never);
    jest.mocked(catalogService.createTrackInAlbum).mockResolvedValue({} as never);
    jest.mocked(catalogService.createAlbum).mockResolvedValue({} as never);
    jest.mocked(catalogService.listArtistAlbums).mockResolvedValue([]);
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
});
