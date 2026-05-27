import {
  buildAlbumQueue,
  buildSingleQueue,
  getQueueOrder,
  getNextQueueTrackId,
  getPreviousQueueTrackId,
  getTrackIdentifier,
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

  it("falls back to the id field when a trackId is not present", () => {
    expect(getTrackIdentifier({ id: "legacy-track" })).toBe("legacy-track");
  });

  it("drops empty identifiers from the queue order", () => {
    expect(getQueueOrder({ ...buildAlbumQueue("album-1", [{ id: "" }, tracks[0]], tracks[0]) })).toEqual(["track-1"]);
  });

  it("does not advance when the queue has no current track", () => {
    expect(getNextQueueTrackId({ ...buildSingleQueue(tracks[0]), currentTrackId: null }, true)).toBeNull();
  });

  it("does not advance when the current track is absent from the order", () => {
    expect(getNextQueueTrackId({ ...buildAlbumQueue("album-1", tracks, tracks[0]), currentTrackId: "missing" }, false)).toBeNull();
  });
});
