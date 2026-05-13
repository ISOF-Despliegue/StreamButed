export type CatalogStatus = "PUBLICADO" | "RETIRADO";

export interface Artist {
  artistId: string;
  displayName: string;
  biography: string | null;
  profileImageAssetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Album {
  albumId: string;
  artistId: string;
  title: string;
  coverAssetId: string | null;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  trackId: string;
  artistId: string;
  albumId: string | null;
  title: string;
  genre: string;
  audioAssetId: string;
  coverAssetId: string | null;
  durationSeconds?: number | null;
  status: CatalogStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSearchResponse {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
  limit?: number;
  offset?: number;
}

export interface AlbumTracksResponse {
  albumId: string;
  tracks: Track[];
}

export interface CatalogSearchParams {
  q: string;
  limit?: number;
  offset?: number;
}

export interface CreateAlbumRequest {
  title: string;
  coverAssetId: string;
}

export interface UpdateAlbumRequest {
  title?: string;
  coverAssetId?: string;
}

export interface CreateTrackRequest {
  albumId?: string | null;
  title: string;
  genre: string;
  audioAssetId: string;
  coverAssetId: string;
  durationSeconds?: number | null;
}

export interface UpdateTrackRequest {
  albumId?: string | null;
  title?: string;
  genre?: string;
  audioAssetId?: string;
  coverAssetId?: string;
  durationSeconds?: number | null;
}

export interface UpdateArtistRequest {
  displayName?: string;
  biography?: string | null;
  profileImageAssetId?: string | null;
}
