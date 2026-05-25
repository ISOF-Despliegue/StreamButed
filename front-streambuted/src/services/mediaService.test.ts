import {
  getAssetUrl,
  getUploadFileHelperText,
  getUploadFileNameError,
  mediaService,
} from "./mediaService";
import { getMediaAssetUrl } from "./gatewayUrl";

describe("mediaService", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({
        assetId: "asset-1",
        assetType: "AUDIO",
        contentType: "audio/mpeg",
        sizeBytes: 20,
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("uploads audio as FormData without manual content type", async () => {
    const file = new File(["audio"], "song.mp3", { type: "audio/mpeg" });

    await mediaService.uploadAudio(file);

    const options = (globalThis.fetch as jest.Mock).mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.headers as Headers).get("Content-Type")).toBeNull();
  });

  it("uploads playlist covers with the PLAYLIST_COVER usage", async () => {
    const file = new File(["cover"], "playlist-cover.png", { type: "image/png" });

    await mediaService.uploadPlaylistCover(file);

    const options = (globalThis.fetch as jest.Mock).mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("usage")).toBe("PLAYLIST_COVER");
  });

  it("accepts audio files when the browser does not provide a MIME type", async () => {
    const file = new File(["audio"], "song.mp3", { type: "" });

    await mediaService.uploadAudio(file);

    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("validates upload file names before sending the request", async () => {
    const file = new File(["audio"], "canción bonita.mp3", { type: "audio/mpeg" });

    expect(getUploadFileNameError(file, "mi-cancion-01.mp3")).toContain(
      "El nombre del archivo solo puede usar letras sin acentos"
    );
    expect(() => mediaService.uploadAudio(file)).toThrow(
      "El nombre del archivo solo puede usar letras sin acentos"
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("explains valid upload file names in helper text", () => {
    expect(getUploadFileHelperText("mi-cancion-01.mp3")).toContain("Ejemplo: mi-cancion-01.mp3");
  });

  it("builds media asset URLs from the public gateway without duplicating /api", () => {
    const expectedUrl = "https://api.migueleelg0106.me/api/v1/media/assets/asset-1";

    expect(getMediaAssetUrl("asset-1")).toBe(expectedUrl);
    expect(getAssetUrl("asset-1")).toBe(expectedUrl);
  });
});
