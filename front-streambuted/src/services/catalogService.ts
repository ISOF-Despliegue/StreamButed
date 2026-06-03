import { apiRequest } from "./apiClient";
import type {
  Album,
  AlbumTracksResponse,
  AdminAlbum,
  AdminCatalogListResponse,
  AdminTrack,
  Artist,
  CatalogSearchParams,
  CatalogSearchResponse,
  CreateAlbumRequest,
  CreateTrackRequest,
  Track,
  UpdateAlbumRequest,
  UpdateArtistRequest,
  UpdateTrackRequest,
} from "../types/catalog.types";
import { withQuery } from "../utils/url";

export const catalogService = {
  searchCatalog(params: CatalogSearchParams): Promise<CatalogSearchResponse> {
    return apiRequest<CatalogSearchResponse>(
      withQuery("/catalog/search", {
        searchTerm: params.searchTerm,
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      })
    );
  },

  getArtist(artistId: string): Promise<Artist> {
    return apiRequest<Artist>(`/catalog/artists/${artistId}`);
  },

  listArtistAlbums(artistId: string): Promise<Album[]> {
    return apiRequest<Album[]>(`/catalog/artists/${artistId}/albums`);
  },

  listArtistTracks(artistId: string): Promise<Track[]> {
    return apiRequest<Track[]>(`/catalog/artists/${artistId}/tracks`);
  },

  listManagedArtistAlbums(artistId: string): Promise<Album[]> {
    return apiRequest<Album[]>(`/catalog/artists/${artistId}/albums/managed`);
  },

  listManagedArtistTracks(artistId: string): Promise<Track[]> {
    return apiRequest<Track[]>(`/catalog/artists/${artistId}/tracks/managed`);
  },

  listAdminAlbums(params: { includeRetired?: boolean; limit?: number; offset?: number; q?: string } = {}): Promise<AdminCatalogListResponse<AdminAlbum>> {
    return apiRequest<AdminCatalogListResponse<AdminAlbum>>(
      withQuery("/catalog/admin/albums", {
        includeRetired: params.includeRetired === false ? "false" : "true",
        q: params.q,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      })
    );
  },

  listAdminTracks(params: { includeRetired?: boolean; limit?: number; offset?: number; q?: string } = {}): Promise<AdminCatalogListResponse<AdminTrack>> {
    return apiRequest<AdminCatalogListResponse<AdminTrack>>(
      withQuery("/catalog/admin/tracks", {
        includeRetired: params.includeRetired === false ? "false" : "true",
        q: params.q,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      })
    );
  },

  updateArtist(artistId: string, request: UpdateArtistRequest): Promise<Artist> {
    return apiRequest<Artist>(`/catalog/artists/${artistId}`, {
      method: "PATCH",
      body: request,
    });
  },

  getAlbum(albumId: string): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}`);
  },

  listAlbumTracks(albumId: string): Promise<AlbumTracksResponse> {
    return apiRequest<AlbumTracksResponse>(`/catalog/albums/${albumId}/tracks`);
  },

  createAlbum(request: CreateAlbumRequest): Promise<Album> {
    return apiRequest<Album>("/catalog/albums", {
      method: "POST",
      body: request,
    });
  },

  updateAlbum(albumId: string, request: UpdateAlbumRequest): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}`, {
      method: "PATCH",
      body: request,
    });
  },

  retireAlbum(albumId: string): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}/retire`, {
      method: "PATCH",
    });
  },

  reinstateAlbum(albumId: string): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}/reinstate`, {
      method: "PATCH",
    });
  },

  deleteAlbum(albumId: string): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}`, {
      method: "DELETE",
    });
  },

  getTrack(trackId: string): Promise<Track> {
    return apiRequest<Track>(`/catalog/tracks/${trackId}`);
  },

  createTrack(request: CreateTrackRequest): Promise<Track> {
    return apiRequest<Track>("/catalog/tracks", {
      method: "POST",
      body: request,
    });
  },

  createTrackInAlbum(albumId: string, request: Omit<CreateTrackRequest, "albumId">): Promise<Track> {
    return apiRequest<Track>(`/catalog/albums/${albumId}/tracks`, {
      method: "POST",
      body: request,
    });
  },

  updateTrack(trackId: string, request: UpdateTrackRequest): Promise<Track> {
    return apiRequest<Track>(`/catalog/tracks/${trackId}`, {
      method: "PATCH",
      body: request,
    });
  },

  retireTrack(trackId: string): Promise<Track> {
    return apiRequest<Track>(`/catalog/tracks/${trackId}/retire`, {
      method: "PATCH",
    });
  },

  reinstateTrack(trackId: string): Promise<Track> {
    return apiRequest<Track>(`/catalog/tracks/${trackId}/reinstate`, {
      method: "PATCH",
    });
  },

  deleteTrack(trackId: string): Promise<Track> {
    return apiRequest<Track>(`/catalog/tracks/${trackId}`, {
      method: "DELETE",
    });
  },
};
