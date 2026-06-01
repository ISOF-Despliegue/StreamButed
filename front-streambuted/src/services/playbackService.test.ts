import { playbackService } from "./playbackService";
import { authTokenStore } from "./authTokenStore";

describe("playbackService", () => {
  beforeEach(() => {
    authTokenStore.clear();
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("creates stream sessions and resolves gateway stream URLs", async () => {
    authTokenStore.setAccessToken("access-token");
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          streamUrl: "/api/v1/playback/tracks/track-1/stream",
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

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/playback/tracks/track-1/stream-session",
      expect.objectContaining({ method: "POST" })
    );
    expect(response.streamUrl).toBe(
      "http://localhost/api/v1/playback/tracks/track-1/stream"
    );
  });

  it("reads and saves playback progress through gateway endpoints", async () => {
    authTokenStore.setAccessToken("access-token");

    await playbackService.getPlaybackProgress("track-1");
    await playbackService.getLatestPlaybackProgress();
    await playbackService.updatePlaybackProgress("track-1", {
      positionSeconds: 12,
      durationSeconds: 180,
      isPlaying: true,
    });

    expect((globalThis.fetch as jest.Mock).mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.body,
    ])).toEqual([
      ["http://localhost/api/v1/playback/progress/track-1", undefined, undefined],
      ["http://localhost/api/v1/playback/progress/latest", undefined, undefined],
      [
        "http://localhost/api/v1/playback/progress/track-1",
        "PUT",
        JSON.stringify({ positionSeconds: 12, durationSeconds: 180, isPlaying: true }),
      ],
    ]);
  });

  it("rethrows failures from every playback operation", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    const results = await Promise.allSettled([
      playbackService.createStreamSession("track-1"),
      playbackService.getPlaybackProgress("track-1"),
      playbackService.getLatestPlaybackProgress(),
      playbackService.updatePlaybackProgress("track-1", { positionSeconds: 0, durationSeconds: null }),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
      "rejected",
    ]);
  });
});
