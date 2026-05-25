import { apiRequest } from "./apiClient";
import type {
  CreatePlaylistRequest,
  LibraryPlaylist,
  LibraryPlaylistDetail,
  LibrarySummary,
  LikeStatus,
  UpdatePlaylistRequest,
} from "../types/library.types";

export const libraryService = {
  getLibrary(): Promise<LibrarySummary> {
    return apiRequest<LibrarySummary>("/library");
  },

  getLikedSongs(): Promise<LibraryPlaylistDetail> {
    return apiRequest<LibraryPlaylistDetail>("/library/liked-songs");
  },

  getTrackLikeStatus(trackId: string): Promise<LikeStatus> {
    return apiRequest<LikeStatus>(`/library/tracks/${trackId}/like-status`);
  },

  likeTrack(trackId: string): Promise<LikeStatus> {
    return apiRequest<LikeStatus>(`/library/tracks/${trackId}/like`, {
      method: "PUT",
    });
  },

  unlikeTrack(trackId: string): Promise<LikeStatus> {
    return apiRequest<LikeStatus>(`/library/tracks/${trackId}/like`, {
      method: "DELETE",
    });
  },

  listPlaylists(): Promise<LibraryPlaylist[]> {
    return apiRequest<LibraryPlaylist[]>("/library/playlists");
  },

  createPlaylist(request: CreatePlaylistRequest): Promise<LibraryPlaylist> {
    return apiRequest<LibraryPlaylist>("/library/playlists", {
      method: "POST",
      body: request,
    });
  },

  getPlaylist(playlistId: string): Promise<LibraryPlaylistDetail> {
    return apiRequest<LibraryPlaylistDetail>(`/library/playlists/${playlistId}`);
  },

  updatePlaylist(
    playlistId: string,
    request: UpdatePlaylistRequest
  ): Promise<LibraryPlaylist> {
    return apiRequest<LibraryPlaylist>(`/library/playlists/${playlistId}`, {
      method: "PATCH",
      body: request,
    });
  },

  deletePlaylist(playlistId: string): Promise<void> {
    return apiRequest<void>(`/library/playlists/${playlistId}`, {
      method: "DELETE",
    });
  },

  addTrackToPlaylist(
    playlistId: string,
    trackId: string
  ): Promise<LibraryPlaylistDetail> {
    return apiRequest<LibraryPlaylistDetail>(`/library/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: { trackId },
    });
  },

  removeTrackFromPlaylist(
    playlistId: string,
    trackId: string
  ): Promise<LibraryPlaylistDetail> {
    return apiRequest<LibraryPlaylistDetail>(
      `/library/playlists/${playlistId}/tracks/${trackId}`,
      { method: "DELETE" }
    );
  },
};
