import { apiRequest } from "./apiClient";
import { analyticsService } from "./analyticsService";

jest.mock("./apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("analyticsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls artist and admin analytics endpoints", async () => {
    jest.mocked(apiRequest)
      .mockResolvedValueOnce({ artistId: "artist-1" } as never)
      .mockResolvedValueOnce({ artistId: "artist-1" } as never)
      .mockResolvedValueOnce({ totalPlays: 10 } as never)
      .mockResolvedValueOnce({ topAlbums: [], topArtists: [] } as never);

    await analyticsService.getArtistSummary("artist-1");
    await analyticsService.getArtistPublicSummary("artist-1");
    await analyticsService.getAdminSummary();
    await analyticsService.getDiscoverySummary();

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/analytics/artists/artist-1/summary");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/analytics/artists/artist-1/public-summary");
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/analytics/admin/summary");
    expect(apiRequest).toHaveBeenNthCalledWith(4, "/analytics/discovery/summary");
  });
});
