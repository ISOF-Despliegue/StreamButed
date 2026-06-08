import { toPlaylistSummary } from "./libraryEventPayloads";

describe("libraryEventPayloads", () => {
  it("returns null for missing playlists", () => {
    expect(toPlaylistSummary(null)).toBeNull();
  });

  it("normalizes optional playlist fields", () => {
    expect(
      toPlaylistSummary({
        playlistId: "playlist-1",
        name: "Ruta nocturna",
        trackCount: "2",
        isSystem: 0,
        createdAt: "2026-06-07T00:00:00.000Z",
        updatedAt: "2026-06-07T00:00:00.000Z",
      })
    ).toEqual({
      playlistId: "playlist-1",
      name: "Ruta nocturna",
      coverAssetId: null,
      isSystem: false,
      systemKey: null,
      trackCount: 2,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });
  });
});
