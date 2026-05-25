type LibraryPlaylistSummaryEventPayload = {
  playlistId: string;
  name: string;
  coverAssetId: string | null;
  isSystem: boolean;
  systemKey: string | null;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
};

type LibraryPlaylistDetailEventPayload = LibraryPlaylistSummaryEventPayload & {
  tracks: unknown[];
};

export type LibraryEvent =
  | { type: 'liked-songs-changed' }
  | { type: 'playlist-created'; playlist: LibraryPlaylistSummaryEventPayload }
  | { type: 'playlist-deleted'; playlistId: string }
  | { type: 'playlist-updated'; playlist: LibraryPlaylistSummaryEventPayload | LibraryPlaylistDetailEventPayload };

const listeners = new Set<(event: LibraryEvent) => void>();

function emit(event: LibraryEvent) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeToLibraryEvents(listener: (event: LibraryEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLikedSongsChanged() {
  emit({ type: 'liked-songs-changed' });
}

export function emitPlaylistCreated(playlist: LibraryPlaylistSummaryEventPayload) {
  emit({ type: 'playlist-created', playlist });
}

export function emitPlaylistDeleted(playlistId: string) {
  emit({ type: 'playlist-deleted', playlistId });
}

export function emitPlaylistUpdated(playlist: LibraryPlaylistSummaryEventPayload | LibraryPlaylistDetailEventPayload) {
  emit({ type: 'playlist-updated', playlist });
}
