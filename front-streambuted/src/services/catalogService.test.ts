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
    await catalogService.searchCatalog({ searchTerm: "night", limit: 10, offset: 5 });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/catalog/search?searchTerm=night&limit=10&offset=5",
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

  it("calls admin catalog list and retire endpoints", async () => {
    await catalogService.listAdminTracks({ includeRetired: false, limit: 25, offset: 50 });
    await catalogService.listAdminAlbums({ limit: 10, offset: 5 });
    await catalogService.retireTrack("track-1");
    await catalogService.retireAlbum("album-1");

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost/api/v1/catalog/admin/tracks?includeRetired=false&limit=25&offset=50",
      expect.any(Object)
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost/api/v1/catalog/admin/albums?includeRetired=true&limit=10&offset=5",
      expect.any(Object)
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      "http://localhost/api/v1/catalog/tracks/track-1/retire",
      expect.objectContaining({ method: "PATCH" })
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      4,
      "http://localhost/api/v1/catalog/albums/album-1/retire",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
