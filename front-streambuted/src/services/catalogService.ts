import { apiRequest } from "./apiClient";
import type {
  Album,
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

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export const catalogService = {
  searchCatalog(params: CatalogSearchParams): Promise<CatalogSearchResponse> {
    return apiRequest<CatalogSearchResponse>(
      withQuery("/catalog/search", {
        q: params.q,
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

  updateArtist(artistId: string, request: UpdateArtistRequest): Promise<Artist> {
    return apiRequest<Artist>(`/catalog/artists/${artistId}`, {
      method: "PATCH",
      body: request,
    });
  },

  getAlbum(albumId: string): Promise<Album> {
    return apiRequest<Album>(`/catalog/albums/${albumId}`);
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
};
