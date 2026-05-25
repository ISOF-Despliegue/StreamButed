import type { Track } from "./catalog.types";

export interface LibraryTrack extends Track {
  artistName: string;
  albumTitle: string | null;
  addedAt: string | null;
}

export interface LibraryPlaylist {
  playlistId: string;
  name: string;
  coverAssetId: string | null;
  isSystem: boolean;
  systemKey: string | null;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryPlaylistDetail extends LibraryPlaylist {
  tracks: LibraryTrack[];
}

export interface LibrarySummary {
  likedSongs: LibraryPlaylistDetail;
  playlists: LibraryPlaylist[];
}

export interface LikeStatus {
  trackId: string;
  isLiked: boolean;
}

export interface CreatePlaylistRequest {
  name: string;
  coverAssetId?: string | null;
}

export interface UpdatePlaylistRequest {
  name?: string;
  coverAssetId?: string | null;
}
