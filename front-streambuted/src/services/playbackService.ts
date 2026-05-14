import { apiRequest, buildApiUrl } from "./apiClient";
import type {
  LatestPlaybackProgressResponse,
  PlaybackProgressRequest,
  PlaybackProgressResponse,
  StreamSessionResponse,
} from "../types/playback.types";

export const playbackService = {
  async createStreamSession(trackId: string): Promise<StreamSessionResponse> {
    try {
      const response = await apiRequest<StreamSessionResponse>(
        `/playback/tracks/${trackId}/stream-session`,
        { method: "POST" }
      );
      return {
        ...response,
        streamUrl: buildApiUrl(response.streamUrl),
      };
    } catch (error) {
      console.error("Failed to create playback stream session.", error);
      throw error;
    }
  },

  async getPlaybackProgress(trackId: string): Promise<PlaybackProgressResponse> {
    try {
      return await apiRequest<PlaybackProgressResponse>(`/playback/progress/${trackId}`);
    } catch (error) {
      console.error("Failed to load playback progress.", error);
      throw error;
    }
  },

  async getLatestPlaybackProgress(): Promise<LatestPlaybackProgressResponse> {
    try {
      return await apiRequest<LatestPlaybackProgressResponse>("/playback/progress/latest");
    } catch (error) {
      console.error("Failed to load latest playback progress.", error);
      throw error;
    }
  },

  async updatePlaybackProgress(
    trackId: string,
    payload: PlaybackProgressRequest
  ): Promise<PlaybackProgressResponse> {
    try {
      return await apiRequest<PlaybackProgressResponse>(`/playback/progress/${trackId}`, {
        method: "PUT",
        body: payload,
      });
    } catch (error) {
      console.error("Failed to save playback progress.", error);
      throw error;
    }
  },
};
