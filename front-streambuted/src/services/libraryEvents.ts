const listeners = new Set();

function emit(event) {
  listeners.forEach((listener) => listener(event));
}

export function subscribeToLibraryEvents(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLikedSongsChanged() {
  emit({ type: 'liked-songs-changed' });
}

export function emitPlaylistCreated(playlist) {
  emit({ type: 'playlist-created', playlist });
}

export function emitPlaylistDeleted(playlistId) {
  emit({ type: 'playlist-deleted', playlistId });
}

export function emitPlaylistUpdated(playlist) {
  emit({ type: 'playlist-updated', playlist });
}
