import { playbackService } from "./playbackService";
import { authTokenStore } from "./authTokenStore";

describe("playbackService", () => {
  beforeEach(() => {
    authTokenStore.clear();
    global.fetch = jest.fn();
  });

  it("creates stream sessions and resolves gateway stream URLs", async () => {
    authTokenStore.setAccessToken("access-token");
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          streamUrl: "/api/v1/playback/tracks/track-1/stream?playbackToken=token",
          expiresAt: "2026-05-11T00:00:00Z",
          trackId: "track-1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const response = await playbackService.createStreamSession("track-1");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/playback/tracks/track-1/stream-session",
      expect.objectContaining({ method: "POST" })
    );
    expect(response.streamUrl).toBe(
      "http://localhost/api/v1/playback/tracks/track-1/stream?playbackToken=token"
    );
  });
});
