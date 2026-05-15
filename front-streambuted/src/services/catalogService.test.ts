import { catalogService } from "./catalogService";

describe("catalogService", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ artists: [], albums: [], tracks: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("calls catalog search through gateway", async () => {
    await catalogService.searchCatalog({ q: "night", limit: 10, offset: 5 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/catalog/search?q=night&limit=10&offset=5",
      expect.any(Object)
    );
  });

  it("gets album tracks through gateway", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ albumId: "album-1", tracks: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await catalogService.listAlbumTracks("album-1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/catalog/albums/album-1/tracks",
      expect.any(Object)
    );
  });
});
