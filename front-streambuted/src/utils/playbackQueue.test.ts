import {
  buildAlbumQueue,
  buildSingleQueue,
  getNextQueueTrackId,
  getPreviousQueueTrackId,
} from "./playbackQueue";

const tracks = [
  { trackId: "track-1", title: "Uno" },
  { trackId: "track-2", title: "Dos" },
  { trackId: "track-3", title: "Tres" },
];

describe("playbackQueue", () => {
  it("repeats a single only when repeat is enabled", () => {
    const queue = buildSingleQueue(tracks[0]);

    expect(getNextQueueTrackId(queue, false)).toBeNull();
    expect(getNextQueueTrackId(queue, true)).toBe("track-1");
    expect(getPreviousQueueTrackId(queue)).toBeNull();
  });

  it("moves through album tracks and loops only when repeat is enabled", () => {
    const middleQueue = buildAlbumQueue("album-1", tracks, tracks[1]);
    const lastQueue = buildAlbumQueue("album-1", tracks, tracks[2]);

    expect(getNextQueueTrackId(middleQueue, false)).toBe("track-3");
    expect(getPreviousQueueTrackId(middleQueue)).toBe("track-1");
    expect(getNextQueueTrackId(lastQueue, false)).toBeNull();
    expect(getNextQueueTrackId(lastQueue, true)).toBe("track-1");
  });

  it("uses the shuffled order for next and previous album tracks", () => {
    const queue = {
      ...buildAlbumQueue("album-1", tracks, tracks[1]),
      shuffleEnabled: true,
      shuffledTrackIds: ["track-2", "track-3", "track-1"],
    };

    expect(getNextQueueTrackId(queue, false)).toBe("track-3");
    expect(getPreviousQueueTrackId({ ...queue, currentTrackId: "track-1" })).toBe("track-3");
  });
});
