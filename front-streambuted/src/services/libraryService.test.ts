import { apiRequest } from "./apiClient";
import { libraryService } from "./libraryService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("libraryService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the trailing-slash library root endpoint", async () => {
    jest.mocked(apiRequest).mockResolvedValueOnce({ playlists: [], likedSongs: null } as never);

    await libraryService.getLibrary();

    expect(apiRequest).toHaveBeenCalledWith("/library/");
  });

  it("maps library reads, likes, and playlist mutations to their API endpoints", async () => {
    jest.mocked(apiRequest).mockResolvedValue({} as never);

    await libraryService.getLikedSongs();
    await libraryService.getTrackLikeStatus("track-1");
    await libraryService.likeTrack("track-1");
    await libraryService.unlikeTrack("track-1");
    await libraryService.listPlaylists();
    await libraryService.createPlaylist({ name: "Road mix", coverAssetId: "cover-1" });
    await libraryService.getPlaylist("playlist-1");
    await libraryService.updatePlaylist("playlist-1", { name: "Road mix 2" });
    await libraryService.deletePlaylist("playlist-1");
    await libraryService.addTrackToPlaylist("playlist-1", "track-1");
    await libraryService.removeTrackFromPlaylist("playlist-1", "track-1");

    expect(jest.mocked(apiRequest).mock.calls).toEqual([
      ["/library/liked-songs"],
      ["/library/tracks/track-1/like-status"],
      ["/library/tracks/track-1/like", { method: "PUT" }],
      ["/library/tracks/track-1/like", { method: "DELETE" }],
      ["/library/playlists"],
      ["/library/playlists", { method: "POST", body: { name: "Road mix", coverAssetId: "cover-1" } }],
      ["/library/playlists/playlist-1"],
      ["/library/playlists/playlist-1", { method: "PATCH", body: { name: "Road mix 2" } }],
      ["/library/playlists/playlist-1", { method: "DELETE" }],
      ["/library/playlists/playlist-1/tracks", { method: "POST", body: { trackId: "track-1" } }],
      ["/library/playlists/playlist-1/tracks/track-1", { method: "DELETE" }],
    ]);
  });
});
