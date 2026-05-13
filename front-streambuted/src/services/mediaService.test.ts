import { mediaService } from "./mediaService";

describe("mediaService", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(
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

    const options = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.headers as Headers).get("Content-Type")).toBeNull();
  });

  it("accepts audio files when the browser does not provide a MIME type", async () => {
    const file = new File(["audio"], "song.mp3", { type: "" });

    await mediaService.uploadAudio(file);

    expect(global.fetch).toHaveBeenCalled();
  });
});
