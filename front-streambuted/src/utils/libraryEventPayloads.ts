export function toPlaylistSummary(playlist) {
  if (!playlist) {
    return null;
  }

  return {
    playlistId: playlist.playlistId,
    name: playlist.name,
    coverAssetId: playlist.coverAssetId ?? null,
    isSystem: Boolean(playlist.isSystem),
    systemKey: playlist.systemKey ?? null,
    trackCount: Number(playlist.trackCount ?? 0),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}
