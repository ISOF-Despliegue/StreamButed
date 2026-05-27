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

  it("maps artist, album, and track catalog commands to gateway endpoints", async () => {
    await catalogService.getArtist("artist-1");
    await catalogService.listArtistAlbums("artist-1");
    await catalogService.listArtistTracks("artist-1");
    await catalogService.updateArtist("artist-1", { displayName: "Ada" });
    await catalogService.getAlbum("album-1");
    await catalogService.createAlbum({ title: "Album", coverAssetId: "cover-1" });
    await catalogService.updateAlbum("album-1", { title: "Album 2" });
    await catalogService.getTrack("track-1");
    await catalogService.createTrack({
      albumId: null,
      title: "Song",
      genre: "Pop",
      audioAssetId: "audio-1",
      coverAssetId: "cover-1",
      durationSeconds: 180,
    });
    await catalogService.createTrackInAlbum("album-1", {
      title: "Album song",
      genre: "Rock",
      audioAssetId: "audio-2",
      coverAssetId: "cover-2",
      durationSeconds: 210,
    });
    await catalogService.updateTrack("track-1", { title: "Song 2" });

    expect((globalThis.fetch as jest.Mock).mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ])).toEqual([
      ["http://localhost/api/v1/catalog/artists/artist-1", undefined, undefined],
      ["http://localhost/api/v1/catalog/artists/artist-1/albums", undefined, undefined],
      ["http://localhost/api/v1/catalog/artists/artist-1/tracks", undefined, undefined],
      [
        "http://localhost/api/v1/catalog/artists/artist-1",
        "PATCH",
        JSON.stringify({ displayName: "Ada" }),
      ],
      ["http://localhost/api/v1/catalog/albums/album-1", undefined, undefined],
      [
        "http://localhost/api/v1/catalog/albums",
        "POST",
        JSON.stringify({ title: "Album", coverAssetId: "cover-1" }),
      ],
      [
        "http://localhost/api/v1/catalog/albums/album-1",
        "PATCH",
        JSON.stringify({ title: "Album 2" }),
      ],
      ["http://localhost/api/v1/catalog/tracks/track-1", undefined, undefined],
      [
        "http://localhost/api/v1/catalog/tracks",
        "POST",
        JSON.stringify({
          albumId: null,
          title: "Song",
          genre: "Pop",
          audioAssetId: "audio-1",
          coverAssetId: "cover-1",
          durationSeconds: 180,
        }),
      ],
      [
        "http://localhost/api/v1/catalog/albums/album-1/tracks",
        "POST",
        JSON.stringify({
          title: "Album song",
          genre: "Rock",
          audioAssetId: "audio-2",
          coverAssetId: "cover-2",
          durationSeconds: 210,
        }),
      ],
      [
        "http://localhost/api/v1/catalog/tracks/track-1",
        "PATCH",
        JSON.stringify({ title: "Song 2" }),
      ],
    ]);
  });
});
