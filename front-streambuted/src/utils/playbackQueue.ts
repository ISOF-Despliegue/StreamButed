export type QueueTrack = {
  id?: string | null;
  trackId?: string | null;
};

export type PlaybackSourceType = "single" | "album";

export type PlaybackQueueState<TTrack extends QueueTrack> = {
  sourceType: PlaybackSourceType;
  albumId: string | null;
  tracks: TTrack[];
  currentTrackId: string | null;
  currentIndex: number;
  shuffleEnabled: boolean;
  shuffledTrackIds: string[];
};

export function getTrackIdentifier(track: QueueTrack | null | undefined): string {
  return track?.trackId ?? track?.id ?? "";
}

export function buildSingleQueue<TTrack extends QueueTrack>(
  track: TTrack
): PlaybackQueueState<TTrack> {
  return {
    sourceType: "single",
    albumId: null,
    tracks: [track],
    currentTrackId: getTrackIdentifier(track),
    currentIndex: 0,
    shuffleEnabled: false,
    shuffledTrackIds: [],
  };
}

export function buildAlbumQueue<TTrack extends QueueTrack>(
  albumId: string,
  tracks: TTrack[],
  track: TTrack
): PlaybackQueueState<TTrack> {
  const currentTrackId = getTrackIdentifier(track);
  const currentIndex = Math.max(
    0,
    tracks.findIndex((item) => getTrackIdentifier(item) === currentTrackId)
  );

  return {
    sourceType: "album",
    albumId,
    tracks,
    currentTrackId,
    currentIndex,
    shuffleEnabled: false,
    shuffledTrackIds: [],
  };
}

export function getQueueOrder<TTrack extends QueueTrack>(
  queue: PlaybackQueueState<TTrack>
): string[] {
  if (queue.shuffleEnabled && queue.shuffledTrackIds.length > 0) {
    return queue.shuffledTrackIds;
  }

  return queue.tracks.map(getTrackIdentifier).filter(Boolean);
}

export function getNextQueueTrackId<TTrack extends QueueTrack>(
  queue: PlaybackQueueState<TTrack>,
  repeatEnabled: boolean
): string | null {
  if (!queue.currentTrackId) {
    return null;
  }

  if (queue.sourceType === "single") {
    return repeatEnabled ? queue.currentTrackId : null;
  }

  const order = getQueueOrder(queue);
  const currentOrderIndex = order.indexOf(queue.currentTrackId);

  if (currentOrderIndex < 0) {
    return null;
  }

  if (currentOrderIndex < order.length - 1) {
    return order[currentOrderIndex + 1] ?? null;
  }

  return repeatEnabled ? (order[0] ?? null) : null;
}

export function getPreviousQueueTrackId<TTrack extends QueueTrack>(
  queue: PlaybackQueueState<TTrack>
): string | null {
  if (queue.sourceType !== "album" || !queue.currentTrackId) {
    return null;
  }

  const order = getQueueOrder(queue);
  const currentOrderIndex = order.indexOf(queue.currentTrackId);

  if (currentOrderIndex <= 0) {
    return null;
  }

  return order[currentOrderIndex - 1] ?? null;
}
